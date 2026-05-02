"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import {
  getToken,
  onMessage,
} from "firebase/messaging";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db, messaging, storage } from "@/lib/firebase";
import { AppNotification, TaskModel, UserModel, VaultTransaction } from "@/lib/types";

type LoadingState<T> = {
  data: T;
  loading: boolean;
  error?: string;
};

const emptyUser: UserModel = {
  email: "",
  password: "",
  fullName: "Intern",
  role: "Intern",
  credits: 0,
  transactions: [],
  submittedTaskDates: {},
  submittedBonusTaskDates: {},
  completedTaskDates: {},
  completedBonusTaskDates: {},
  notificationsEnabled: true,
};

function isoFromUnknown(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date(String(value)).toISOString();
}

export function parseDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatShortDate(value?: string): string {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export function formatDue(value?: string): string {
  const date = parseDate(value);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 0) return "Overdue";
  if (diffMin < 60) return `${Math.max(diffMin, 0)}m left`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ${diffMin % 60}m left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

export function formatRelative(value?: string): string {
  const diff = Date.now() - parseDate(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function isSubmittedForUser(task: TaskModel, user?: UserModel | null) {
  const email = user?.email;
  if (!email) return false;

  const taskIdLower = task.id.toLowerCase();
  const taskTitleLower = (task.title || "").toLowerCase();

  // HARD GUARD 1: If the task is in the user's completedTaskDates map, it's done
  const userCompletedDates = user?.completedTaskDates || {};
  const inUserCompletedMap = Object.keys(userCompletedDates).some(k => k.toLowerCase() === taskIdLower);
  if (inUserCompletedMap) return false;

  // HARD GUARD 2: If the task's completedByUserEmails contains this user, it's done
  const inTaskCompletedList = task.completedByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase());
  if (inTaskCompletedList) return false;

  // HARD GUARD 3: If there is ANY approved (non-bonus) transaction linked to this task (by ID or title)
  const hasApprovedTx = user?.transactions?.some(t => {
    if (t.status !== "approved") return false;
    if (t.isBonus === true) return false;
    // Match by taskId
    if (t.taskId != null && t.taskId.toLowerCase() === taskIdLower) return true;
    // Match by title containment (handles "Completed: <task title>" format)
    const txTitle = (t.title || "").toLowerCase();
    if (taskTitleLower && txTitle.includes(taskTitleLower)) return true;
    if (taskTitleLower && taskTitleLower.includes(txTitle.replace(/^completed:\s*/i, "").trim())) return true;
    return false;
  });
  if (hasApprovedTx) return false;

  // HARD GUARD 4: Fallback to the full mainTaskCompletedForUser check (fuzzy matching)
  if (mainTaskCompletedForUser(task, user)) return false;

  // 1. Check Task document
  const inTaskSubmittedList = task.submittedByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase());

  // 2. Check User document map with case-insensitive keys
  const userSubmittedDates = user?.submittedTaskDates || {};
  const inUserSubmittedMap = Object.keys(userSubmittedDates).some(k => k.toLowerCase() === taskIdLower);

  // If neither source says "submitted", it's not submitted
  if (!inTaskSubmittedList && !inUserSubmittedMap) return false;

  // HARD GUARD 5 (STALE DATA RESCUE): The task appears submitted, but if there is
  // NO pending transaction for this task, the approval already happened and cleanup
  // failed (e.g. the approved transaction had a generic title like "Credits" with no
  // taskId). In that case, treat it as NOT submitted.
  const hasPendingTx = user?.transactions?.some(t => {
    if (t.status !== "pending") return false;
    // Match by taskId
    if (t.taskId != null && t.taskId.toLowerCase() === taskIdLower) return true;
    // Match by title containment
    const txTitle = (t.title || "").toLowerCase();
    if (taskTitleLower && taskTitleLower.length > 3 && txTitle.includes(taskTitleLower)) return true;
    // Match by amount (same credits as the task)
    if (t.amount === task.credits) return true;
    return false;
  });

  if (!hasPendingTx) {
    // No pending transaction found — the approval already happened, stale data remains
    console.log(`[isSubmittedForUser] GUARD5 RESCUE: "${task.title}" has NO pending tx → treating as completed (stale data cleanup needed)`);
    return false;
  }

  return true;
}

export function isBonusSubmittedForUser(task: TaskModel, user?: UserModel | null) {
  const email = user?.email;
  if (!email || !task.bonusAvailable) return false;

  const taskIdLower = task.id.toLowerCase();

  // HARD GUARD 1: If completedBonusTaskDates has this task, it's done
  const userCompletedBonusDates = user?.completedBonusTaskDates || {};
  if (Object.keys(userCompletedBonusDates).some(k => k.toLowerCase() === taskIdLower)) return false;

  // HARD GUARD 2: If the task's completedBonusByUserEmails contains this user, it's done
  if (task.completedBonusByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase())) return false;

  // HARD GUARD 3: Approved bonus transaction for this taskId
  const hasApprovedBonusTx = user?.transactions?.some(t =>
    t.status === "approved" &&
    t.isBonus === true &&
    t.taskId != null &&
    t.taskId.toLowerCase() === taskIdLower
  );
  if (hasApprovedBonusTx) return false;

  // Fallback to full check
  if (bonusTaskCompletedForUser(task, user)) return false;

  // 1. Check Task doc
  const inTaskSubmittedList = task.submittedBonusByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase());

  // 2. Check User doc
  const userSubmittedDates = user?.submittedBonusTaskDates || {};
  const inUserSubmittedMap = Object.keys(userSubmittedDates).some(k => k.toLowerCase() === taskIdLower);

  return inTaskSubmittedList || inUserSubmittedMap;
}

export function mainTaskCompletedForUser(task: TaskModel, user?: UserModel | null) {
  const email = user?.email;
  if (!email) return false;

  const taskIdLower = task.id.toLowerCase();
  const taskTitleLower = (task.title || "").toLowerCase();

  // 1. Check explicit completion lists
  const inTaskCompletedList = task.completedByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase());
  const userCompletedDates = user?.completedTaskDates || {};
  const inUserCompletedMap = Object.keys(userCompletedDates).some(k => k.toLowerCase() === taskIdLower);

  if (inTaskCompletedList || inUserCompletedMap) return true;

  // 2. SEARCH TRANSACTIONS (The "Force" logic)
  if (!user?.transactions) {
    // No transactions at all — fall through to stale data check
  } else {
    const hasApprovedTransaction = user.transactions.some(t => {
      // Only approved, non-bonus transactions count for main task completion
      if (t.status !== "approved") return false;
      if (t.isBonus === true) return false;

      const txTaskId = (t.taskId || "").toLowerCase();
      const txTitle = (t.title || t.description || "").toLowerCase();

      // Match by ID
      if (txTaskId === taskIdLower) return true;

      // Match by exact title match (case insensitive)
      if (txTitle === taskTitleLower) return true;

      // Match by containment
      if (taskTitleLower.length > 3 && txTitle.includes(taskTitleLower)) return true;
      if (txTitle.length > 3 && taskTitleLower.includes(txTitle)) return true;

      // Keyword match: If the transaction contains at least two significant words from the task title
      const keywords = taskTitleLower.split(" ").filter(w => w.length > 3);
      if (keywords.length > 0) {
        const matchCount = keywords.filter(word => txTitle.includes(word)).length;
        if (matchCount >= Math.min(2, keywords.length)) return true;
      }

      return false;
    });

    if (hasApprovedTransaction) return true;
  }

  // 3. STALE DATA RESCUE: If the task appears submitted (in submittedByUserEmails or
  // submittedTaskDates) but there is NO pending transaction for it, the admin already
  // approved it but the cleanup failed (e.g. generic transaction title "Credits" with
  // no taskId). Treat as completed to prevent permanent "Pending Review" state.
  const isInSubmittedList = task.submittedByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase());
  const userSubmittedDates = user?.submittedTaskDates || {};
  const isInSubmittedMap = Object.keys(userSubmittedDates).some(k => k.toLowerCase() === taskIdLower);

  if (isInSubmittedList || isInSubmittedMap) {
    const hasPendingTx = user?.transactions?.some(t => {
      if (t.status !== "pending") return false;
      if (t.isBonus === true) return false;
      // Match by taskId
      if (t.taskId != null && t.taskId.toLowerCase() === taskIdLower) return true;
      // Match by title containment
      const txTitle = (t.title || "").toLowerCase();
      if (taskTitleLower && taskTitleLower.length > 3 && txTitle.includes(taskTitleLower)) return true;
      // Match by amount
      if (t.amount === task.credits) return true;
      return false;
    });

    if (!hasPendingTx) {
      console.log(`[mainTaskCompletedForUser] STALE DATA RESCUE: "${task.title}" is submitted but has NO pending tx → treating as completed`);
      return true;
    }
  }

  return false;
}

export function bonusTaskCompletedForUser(task: TaskModel, user?: UserModel | null) {
  const email = user?.email;
  if (!email || !task.bonusAvailable) return false;

  const taskIdLower = task.id.toLowerCase();
  const taskTitleLower = (task.title || "").toLowerCase();

  // 1. Check Task doc
  const inTaskCompletedList = task.completedBonusByUserEmails?.some(e => e.toLowerCase() === email.toLowerCase());

  // 2. Check User doc
  const userCompletedDates = user?.completedBonusTaskDates || {};
  const inUserCompletedMap = Object.keys(userCompletedDates).some(k => k.toLowerCase() === taskIdLower);

  // 3. Check Transactions
  const hasApprovedTransaction = user?.transactions?.some(t => {
    if (t.status !== "approved") return false;
    if (!t.isBonus) return false;

    if (t.taskId && t.taskId.toLowerCase() === taskIdLower) return true;

    const txTitle = (t.title || "").toLowerCase();
    // Bonus tasks often have "Bonus" in the title
    if (txTitle.includes(taskTitleLower) && txTitle.includes("bonus")) return true;

    return false;
  });

  return inTaskCompletedList || inUserCompletedMap || hasApprovedTransaction;
}

export function activeForUser(task: TaskModel, user?: UserModel | null) {
  const email = user?.email;
  const assigned = task.assignedUserEmails.length === 0 || (email ? task.assignedUserEmails.includes(email) : false);
  const mainDone = mainTaskCompletedForUser(task, user);

  // Task is active if it's assigned and the main task is not yet approved
  return assigned && !mainDone;
}

export function completedForUser(task: TaskModel, user?: UserModel | null) {
  const email = user?.email;
  const assigned = task.assignedUserEmails.length === 0 || (email ? task.assignedUserEmails.includes(email) : false);
  const mainDone = mainTaskCompletedForUser(task, user);

  // Task is completed once the main task is approved
  return assigned && mainDone;
}

export function normalizeTransaction(raw: Record<string, any>): VaultTransaction {
  // Bridge the gap between 'description' (used in markTaskCompleted) and 'title' (used in UI)
  const title = raw.title || raw.description || "Credits";

  // Bridge the gap between 'timestamp' (used in Firestore) and 'date' (used in UI)
  const date = raw.date || raw.timestamp || new Date().toISOString();

  // Use a more stable ID if missing
  const stableId = raw.id ?? `tx-${date}-${raw.amount}-${title}`;

  // Robust Task ID lookup
  const taskId = raw.taskId || raw.task_id || raw.taskID || null;

  return {
    id: stableId,
    title: title,
    amount: Number(raw.amount ?? 0),
    requestedAmount: raw.requestedAmount != null ? Number(raw.requestedAmount) : null,
    awardedAmount: raw.awardedAmount != null ? Number(raw.awardedAmount) : null,
    date: isoFromUnknown(date),
    status: raw.status ?? "approved",
    adminRemarks: raw.adminRemarks ?? null,
    adminName: raw.adminName ?? null,
    description: raw.description ?? title,
    timestamp: isoFromUnknown(date),
    type: raw.type ?? null,
    category: raw.category ?? null,
    userId: raw.userId ?? null,
    userName: raw.userName ?? null,
    taskId: taskId,
    isBonus: Boolean(raw.isBonus ?? false),
    proofUrls: Array.isArray(raw.proofUrls) ? raw.proofUrls : [],
    proofNames: Array.isArray(raw.proofNames) ? raw.proofNames : [],
  };
}

export function normalizeUser(raw?: Record<string, any>, id?: string): UserModel {
  const data = raw ?? {};
  // Use the stored email field for display if it exists, otherwise fallback to document ID
  const displayEmail = (typeof data.email === 'string' && data.email.length > 0) ? data.email : (id ?? "");

  return {
    ...emptyUser,
    email: displayEmail,
    password: data.password ?? "",
    fullName: data.fullName ?? data.name ?? "Intern",
    role: data.role ?? "Intern",
    credits: Number(data.credits ?? 0),
    profilePictureUrl: data.profilePictureUrl ?? null,
    transactions: Array.isArray(data.transactions)
      ? data.transactions.map((tx: Record<string, any>) => normalizeTransaction(tx))
      : [],
    submittedTaskDates: data.submittedTaskDates ?? {},
    submittedBonusTaskDates: data.submittedBonusTaskDates ?? {},
    completedTaskDates: data.completedTaskDates ?? {},
    completedBonusTaskDates: data.completedBonusTaskDates ?? {},
    notificationsEnabled: data.notificationsEnabled ?? true,
  };
}

export function normalizeTask(raw: Record<string, any>, id?: string): TaskModel {
  return {
    id: raw.id ?? id ?? crypto.randomUUID(),
    title: raw.title ?? "Untitled Task",
    description: raw.description ?? "",
    phase: raw.phase ?? "ADMIN ASSIGNED",
    taskType: raw.taskType ?? (raw.isOptional ? "Daily Task" : "Main Task"),
    dueDate: isoFromUnknown(raw.dueDate),
    credits: Number(raw.credits ?? 0),
    bonusAvailable: Boolean(raw.bonusAvailable ?? false),
    bonusDescription: raw.bonusDescription ?? "",
    bonusCredits: Number(raw.bonusCredits ?? 0),
    isCompleted: Boolean(raw.isCompleted ?? false),
    isBonusCompleted: Boolean(raw.isBonusCompleted ?? false),
    submissionDate: raw.submissionDate ? isoFromUnknown(raw.submissionDate) : null,
    assignedUserEmails: Array.isArray(raw.assignedUserEmails) ? raw.assignedUserEmails : [],
    submittedByUserEmails: Array.isArray(raw.submittedByUserEmails) ? raw.submittedByUserEmails : [],
    submittedBonusByUserEmails: Array.isArray(raw.submittedBonusByUserEmails) ? raw.submittedBonusByUserEmails : [],
    completedByUserEmails: Array.isArray(raw.completedByUserEmails) ? raw.completedByUserEmails : [],
    completedBonusByUserEmails: Array.isArray(raw.completedBonusByUserEmails) ? raw.completedBonusByUserEmails : [],
    order: raw.order ?? null,
    isOptional: raw.isOptional ?? false,
  };
}

export function normalizeNotification(raw: Record<string, any>, id?: string): AppNotification {
  return {
    id: raw.id ?? id ?? crypto.randomUUID(),
    title: raw.title ?? "Notification",
    message: raw.message ?? "",
    timestamp: isoFromUnknown(raw.timestamp),
    type: raw.type ?? "general",
    isRead: Boolean(raw.isRead ?? false),
    metadata: raw.metadata,
  };
}

export function useFirebaseAuthUser() {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({ user: null, loading: true });

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      setState((current) => (current.loading ? { user: auth.currentUser, loading: false } : current));
    }, 2500);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(fallback);
      setState({ user, loading: false });
    });
    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  return state;
}

export function useCurrentUser() {
  const { user, loading: authLoading } = useFirebaseAuthUser();
  const [state, setState] = useState<LoadingState<UserModel | null>>({ data: null, loading: true });

  useEffect(() => {
    if (authLoading) return;

    // Check if we have a "typed email" in session storage to enforce strict casing
    const sessionEmail = typeof window !== "undefined" ? sessionStorage.getItem("auth_email") : null;
    const userEmail = sessionEmail || user?.email;

    if (!userEmail) {
      console.log("[useCurrentUser] No sessionEmail or user.email found.");
      setState({ data: null, loading: false });
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    const tryFetchUser = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        if (!active) return;

        // Match case-insensitively first to find the canonical document ID
        const matched = usersSnap.docs.find(d =>
          d.id.toLowerCase() === userEmail.toLowerCase() || 
          (typeof d.data().email === 'string' && d.data().email.toLowerCase() === userEmail.toLowerCase())
        );

        if (!matched) {
          console.warn("[useCurrentUser] No match found in Firestore for:", userEmail);
          await signOut(auth);
          if (typeof window !== "undefined") sessionStorage.removeItem("auth_email");
          if (active) setState({ data: null, loading: false });
          return;
        }

        const exactId = matched.id;
        if (exactId !== sessionEmail && typeof window !== "undefined" && active) {
          sessionStorage.setItem("auth_email", exactId);
        }

        const ref = doc(db, "users", exactId);

        const unsub = onSnapshot(
          ref,
          (snapshot) => {
            if (!active) return;
            if (snapshot.exists()) {
              setState({ data: normalizeUser(snapshot.data(), snapshot.id), loading: false });
            } else {
              signOut(auth);
              if (typeof window !== "undefined") sessionStorage.removeItem("auth_email");
              setState({ data: null, loading: false });
            }
          },
          (error) => {
            if (!active) return;
            setState({ data: null, loading: false, error: error.message });
          },
        );

        if (active) {
          unsubscribe = unsub;
        } else {
          unsub();
        }
      } catch (error: any) {
        if (!active) return;
        console.error("[useCurrentUser] Fatal fetch error:", error);
        setState({ data: null, loading: false, error: error.message });
      }
    };

    tryFetchUser();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [authLoading, user?.email]);

  return { user, userData: state.data, loading: authLoading || state.loading, error: state.error };
}

export function useUsers() {
  const [state, setState] = useState<LoadingState<UserModel[]>>({ data: [], loading: true });

  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const users = snapshot.docs.map((snap) => normalizeUser(snap.data(), snap.id));
        setState({ data: users, loading: false });
      },
      (error) => setState({ data: [], loading: false, error: error.message }),
    );
  }, []);

  return state;
}

export function useTasks() {
  const [state, setState] = useState<LoadingState<TaskModel[]>>({ data: [], loading: true });

  useEffect(() => {
    return onSnapshot(
      collection(db, "tasks"),
      (snapshot) => {
        const tasks = snapshot.docs
          .map((snap) => normalizeTask(snap.data(), snap.id))
          .sort((a, b) => parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime());
        setState({ data: tasks, loading: false });
      },
      (error) => setState({ data: [], loading: false, error: error.message }),
    );
  }, []);

  return state;
}

export function useNotifications(userEmail?: string | null) {
  const [state, setState] = useState<LoadingState<AppNotification[]>>({ data: [], loading: true });

  useEffect(() => {
    if (!userEmail) {
      setState({ data: [], loading: false });
      return;
    }

    const q = query(collection(db, "users", userEmail.toLowerCase(), "notifications"), orderBy("timestamp", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setState({
          data: snapshot.docs.map((snap) => normalizeNotification(snap.data(), snap.id)),
          loading: false,
        });
      },
      (error) => setState({ data: [], loading: false, error: error.message }),
    );
  }, [userEmail]);

  return state;
}

export function useInterns() {
  const users = useUsers();
  return useMemo(
    () => ({
      ...users,
      data: users.data.filter((user) => user.role !== "Admin"),
    }),
    [users],
  );
}

export async function registerUser(fullName: string, email: string, password: string) {
  const originalEmail = email.trim();
  const cleanEmail = originalEmail.toLowerCase();

  await createUserWithEmailAndPassword(auth, cleanEmail, password);
  await setDoc(doc(db, "users", cleanEmail), {
    email: originalEmail, // Store exact casing provided by user
    password,
    fullName,
    role: "Intern",
    credits: 0,
    profilePictureUrl: null,
    transactions: [],
    submittedTaskDates: {},
    submittedBonusTaskDates: {},
    completedTaskDates: {},
    completedBonusTaskDates: {},
    notificationsEnabled: true,
  });

  // Force clean up and sign out to prevent auto-login
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("auth_email");
  }
  await signOut(auth);
}

export async function loginUser(email: string, password: string) {
  const inputEmail = email.trim();

  const userCredential = await signInWithEmailAndPassword(auth, inputEmail, password);
  const user = userCredential.user;

  if (user) {
    const usersSnap = await getDocs(collection(db, "users"));
    const matched = usersSnap.docs.find(d => 
      d.id.toLowerCase() === inputEmail.toLowerCase() || 
      (typeof d.data().email === 'string' && d.data().email.toLowerCase() === inputEmail.toLowerCase())
    );

    if (matched) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("auth_email", matched.id);
      }
    } else {
      await signOut(auth);
      throw new Error("Invalid credentials. Account setup incomplete.");
    }
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  sessionStorage.removeItem("auth_email"); // Google handles its own casing

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (user && user.email) {
      const cleanEmail = user.email.toLowerCase();
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, "users", cleanEmail));

      if (!userDoc.exists()) {
        console.log("[Google Login] First time login for:", user.email, "Auto-creating Admin profile.");

        // AUTO-CREATE ADMIN PROFILE for you since this is a new project
        // You can remove this 'Admin' logic later once your cohort is set up
        await setDoc(doc(db, "users", cleanEmail), {
          ...emptyUser,
          email: user.email,
          fullName: user.displayName || "Admin",
          role: "Admin", // Automatically making you an Admin on first login
          credits: 0,
        });
      }

      sessionStorage.setItem("auth_email", cleanEmail);
    }
    return result;
  } catch (error: any) {
    console.error("Google Login Error:", error);
    throw error;
  }
}

export async function logoutUser() {
  sessionStorage.removeItem("auth_email");
  await signOut(auth);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("auth_email");
  }
}

export async function sendReset(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const userDoc = await getDoc(doc(db, "users", cleanEmail));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.email) {
        // Use the preserved casing for the reset email
        await sendPasswordResetEmail(auth, data.email);
        return;
      }
    }
  } catch (error) {
    console.warn("[sendReset] Could not find preserved casing:", error);
  }
  // Fallback to provided email
  await sendPasswordResetEmail(auth, email);
}

import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";

// ... existing code ...

export async function uploadProfilePicture(email: string, file: File) {
  try {
    const currentUserEmail = auth.currentUser?.email;
    console.log("[uploadProfilePicture] Current Auth Email:", currentUserEmail);
    console.log("[uploadProfilePicture] Target User Email:", email);

    if (currentUserEmail !== email) {
      console.warn("[uploadProfilePicture] Warning: Email mismatch might cause Permission Denied.");
    }

    const storageRef = ref(storage, `profiles/${email}/${Date.now()}_${file.name}`);
    console.log("[uploadProfilePicture] Starting upload to:", storageRef.fullPath);

    const snapshot = await uploadBytes(storageRef, file);
    console.log("[uploadProfilePicture] Upload successful.");

    const downloadURL = await getDownloadURL(snapshot.ref);
    await updateDoc(doc(db, "users", email.toLowerCase()), { profilePictureUrl: downloadURL });
    return downloadURL;
  } catch (error: any) {
    console.error("[uploadProfilePicture] Firebase Storage Error:", error.code, error.message);
    throw error;
  }
}

export async function updateAvatar(email: string, avatarId: string) {
  await updateDoc(doc(db, "users", email.toLowerCase()), { profilePictureUrl: avatarId });
}

export async function updateFullName(email: string, fullName: string) {
  await updateDoc(doc(db, "users", email.toLowerCase()), { fullName });
}

export async function toggleNotifications(email: string, enabled: boolean) {
  await updateDoc(doc(db, "users", email.toLowerCase()), { notificationsEnabled: enabled });
}

export async function uploadProof(email: string, files: File[], onProgress?: (progress: number) => void) {
  try {
    const currentUser = auth.currentUser;
    console.log("[uploadProof] Starting upload sequence:");
    console.log("[uploadProof] Target Email Folder:", email);
    console.log("[uploadProof] Logged-in User Email:", currentUser?.email);
    console.log("[uploadProof] User UID:", currentUser?.uid);

    const urls: string[] = [];
    const names: string[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const storagePath = `proofs/${email.trim().toLowerCase()}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);

      console.log(`[uploadProof] Uploading file ${i+1}/${totalFiles}:`, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const fileProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const overallProgress = ((i / totalFiles) * 100) + (fileProgress / totalFiles);
            if (onProgress) onProgress(overallProgress);
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      urls.push(downloadURL);
      names.push(file.name);
    }

    return { urls, names };
  } catch (error: any) {
    console.error("[uploadProof] Firebase Storage Error:", error.code, error.message);
    throw error;
  }
}

export async function requestCredits(user: UserModel, amount: number, title: string, taskId?: string, isBonus?: boolean, proofUrls?: string[], proofNames?: string[]) {
  const tx: VaultTransaction = {
    id: crypto.randomUUID(),
    title,
    amount,
    date: new Date().toISOString(),
    status: "pending",
    taskId: taskId ?? null,
    isBonus: !!isBonus,
    proofUrls: proofUrls ?? [],
    proofNames: proofNames ?? []
  };

  await updateDoc(doc(db, "users", user.email.toLowerCase()), {
    transactions: arrayUnion(tx),
  });
}

export async function sendNotification(recipientEmail: string, title: string, message: string, type: string, metadata?: Record<string, unknown>) {
  const cleanEmail = recipientEmail.toLowerCase();
  const userSnap = await getDoc(doc(db, "users", cleanEmail));
  if (userSnap.exists() && userSnap.data().notificationsEnabled === false) return;

  const id = crypto.randomUUID();
  await setDoc(doc(db, "users", cleanEmail, "notifications", id), {
    id,
    title,
    message,
    timestamp: new Date().toISOString(),
    type,
    isRead: false,
    metadata: metadata ?? null,
  });
}

export async function broadcastToAdmins(title: string, message: string, type: string, metadata?: Record<string, unknown>) {
  const admins = await getDocs(query(collection(db, "users"), where("role", "==", "Admin")));
  await Promise.all(admins.docs.map((snap) => sendNotification(snap.id, title, message, type, metadata)));
}

export async function markTaskCompleted(user: UserModel, task: TaskModel, isBonus = false, proofUrls?: string[], proofNames?: string[]) {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const taskRef = doc(db, "tasks", task.id);
  const userRef = doc(db, "users", user.email.toLowerCase());

  if (isBonus) {
    batch.update(taskRef, {
      submittedBonusByUserEmails: arrayUnion(user.email),
    });
    batch.update(userRef, {
      [`submittedBonusTaskDates.${task.id}`]: now,
    });
  } else {
    batch.update(taskRef, {
      submittedByUserEmails: arrayUnion(user.email),
      submissionDate: now,
    });
    batch.update(userRef, {
      [`submittedTaskDates.${task.id}`]: now,
    });
  }

  const finalCredits = !isBonus && parseDate(task.dueDate).getTime() < Date.now() ? Math.round(task.credits / 2) : (isBonus ? task.bonusCredits : task.credits);

  const txTitle = `Completed: ${isBonus ? "Bonus Task" : task.title}${!isBonus && finalCredits < task.credits ? " (Late Submission)" : ""}`;
  const tx: VaultTransaction = {
    id: `TX-${Date.now()}`,
    title: txTitle,
    userId: user.email,
    userName: user.fullName,
    amount: finalCredits,
    date: now,
    type: "credit",
    status: "pending",
    category: "Task",
    description: txTitle,
    timestamp: now,
    taskId: task.id,
    isBonus: isBonus,
    proofUrls: proofUrls ?? [],
    proofNames: proofNames ?? []
  };

  batch.update(userRef, {
    transactions: arrayUnion(tx)
  });

  await batch.commit();

  await broadcastToAdmins(
    isBonus ? "Bonus Task Completed" : "Task Completed",
    `${user.fullName} completed "${isBonus ? task.bonusDescription : task.title}".`,
    "review_needed",
    {
      taskId: task.id,
      internEmail: user.email,
      isBonus
    }
  );
}

export async function withdrawSubmission(user: UserModel, task: TaskModel, isBonus = false) {
  const userRef = doc(db, "users", user.email.toLowerCase());
  const taskRef = doc(db, "tasks", task.id);

  const batch = writeBatch(db);

  // 1. Remove user from task's submission list
  const field = isBonus ? "submittedBonusByUserEmails" : "submittedByUserEmails";
  batch.update(taskRef, {
    [field]: arrayRemove(user.email)
  });

  // Handle lowercase as well just in case
  if (user.email.toLowerCase() !== user.email) {
    batch.update(taskRef, {
      [field]: arrayRemove(user.email.toLowerCase())
    });
  }

  // 2. Remove the submission date from user record
  batch.update(userRef, {
    [isBonus ? `submittedBonusTaskDates.${task.id}` : `submittedTaskDates.${task.id}`]: deleteField()
  });

  // 3. Remove the pending transaction
  const updatedTransactions = user.transactions.filter(tx =>
    !(tx.taskId === task.id && tx.isBonus === isBonus && tx.status === "pending")
  );

  // CRITICAL FIX: Firestore does not accept 'undefined' values.
  // normalizedTransactions often have undefined fields (requestedAmount, awardedAmount).
  const cleanTransactions = JSON.parse(JSON.stringify(updatedTransactions));
  batch.update(userRef, { transactions: cleanTransactions });

  await batch.commit();
}

export async function addTask(task: TaskModel) {
  try {
    console.log("[addTask] Saving task to Firestore:", task.id);
    await setDoc(doc(db, "tasks", task.id), task);

    console.log("[addTask] Fetching interns for notifications...");
    const interns = await getDocs(query(collection(db, "users"), where("role", "==", "Intern")));

    if (interns.empty) {
      console.log("[addTask] No interns found to notify.");
      return;
    }

    console.log(`[addTask] Sending notifications to ${interns.size} interns.`);
    await Promise.all(
      interns.docs.map((snap) =>
        sendNotification(
          snap.id,
          "New Task Assigned",
          `A new task "${task.title}" has been added to ${task.phase}. Check it out!`,
          "task_new",
          { taskId: task.id },
        ).catch(err => console.error(`[addTask] Failed to notify ${snap.id}:`, err))
      ),
    );
  } catch (error: any) {
    console.error("[addTask] Error in addTask:", error);
    throw error;
  }
}

export async function updateTask(task: TaskModel) {
  await updateDoc(doc(db, "tasks", task.id), task as unknown as Record<string, unknown>);
}

export async function deleteTask(taskId: string) {
  await deleteDoc(doc(db, "tasks", taskId));
}

export async function approveTransaction(user: UserModel, tx: VaultTransaction, remarks?: string, adminName = "Admin", awardAmount?: number) {
  if (!user?.email) throw new Error("Cannot approve: User email is missing.");

  const requestedAmount = Number(tx.requestedAmount ?? tx.amount) || 0;
  const pendingAmount = Number(tx.amount) || requestedAmount;
  const requestedCap = Math.max(requestedAmount, pendingAmount);
  const proposedAward = typeof awardAmount === "number" && Number.isFinite(awardAmount) ? Math.round(awardAmount) : pendingAmount;
  const approvedAmount = requestedCap > 0 ? Math.min(Math.max(proposedAward, 1), requestedCap) : 0;

  const transactions = user.transactions.map((item) =>
    item.id === tx.id ? {
      ...item,
      amount: approvedAmount,
      requestedAmount: Number(item.requestedAmount ?? item.amount ?? requestedAmount) || requestedAmount,
      awardedAmount: approvedAmount,
      status: "approved" as const,
      adminRemarks: remarks || null,
      adminName: adminName || "Admin"
    } : item,
  );

  // Firestore does not accept 'undefined'. We use JSON stringify/parse to strip any accidental undefineds.
  const cleanTransactions = JSON.parse(JSON.stringify(transactions));

  const updates: Record<string, any> = {
    transactions: cleanTransactions,
    credits: increment(approvedAmount),
  };

  // If this transaction was linked to a task, mark the task as COMPLETED and remove from PENDING
  let targetTaskId = tx.taskId;

  // ROBUST LINKING: If taskId is missing, try to find the task by title match
  if (!targetTaskId) {
    const txTitle = (tx.title || "").toLowerCase();
    // This is a bit expensive but ensures data integrity
    const allTasks = await getDocs(collection(db, "tasks"));
    const matchingTask = allTasks.docs.find(d => {
      const taskData = d.data();
      const title = (taskData.title || "").toLowerCase();
      return txTitle.includes(title) || title.includes(txTitle);
    });
    if (matchingTask) targetTaskId = matchingTask.id;
  }

  if (targetTaskId) {
    const now = new Date().toISOString();
    if (tx.isBonus) {
      updates[`completedBonusTaskDates.${targetTaskId}`] = now;
      // Always clear submission dates to avoid stale "pending" state
      updates[`submittedBonusTaskDates.${targetTaskId}`] = deleteField();
    } else {
      updates[`completedTaskDates.${targetTaskId}`] = now;
      // Always clear submission dates to avoid stale "pending" state
      updates[`submittedTaskDates.${targetTaskId}`] = deleteField();
    }
  } else {
    // Even without a matched task, wipe any submission date entries
    // that match the transaction title to prevent stale pending state.
    // We do this by scanning user's submittedTaskDates for keys that
    // match the transaction title.
    const txTitle = (tx.title || "").toLowerCase().replace(/^completed:\s*/i, "").trim();
    Object.keys(user.submittedTaskDates || {}).forEach(key => {
      if (txTitle && key.toLowerCase().includes(txTitle)) {
        updates[`submittedTaskDates.${key}`] = deleteField();
        updates[`completedTaskDates.${key}`] = new Date().toISOString();
      }
    });
    Object.keys(user.submittedBonusTaskDates || {}).forEach(key => {
      if (txTitle && key.toLowerCase().includes(txTitle)) {
        updates[`submittedBonusTaskDates.${key}`] = deleteField();
        updates[`completedBonusTaskDates.${key}`] = new Date().toISOString();
      }
    });
  }

  await updateDoc(doc(db, "users", user.email.toLowerCase()), updates);

  // Also update the Task document itself for global tracking
  if (targetTaskId) {
    const taskUpdate: Record<string, any> = {
      [tx.isBonus ? "completedBonusByUserEmails" : "completedByUserEmails"]: arrayUnion(user.email)
    };
    // Use case-insensitive removal: fetch the task and remove the matching email
    taskUpdate[tx.isBonus ? "submittedBonusByUserEmails" : "submittedByUserEmails"] = arrayRemove(user.email);

    await updateDoc(doc(db, "tasks", targetTaskId), taskUpdate);

    // Also try to remove with lowercase variant to handle any case mismatches
    const lowerEmail = user.email.toLowerCase();
    if (lowerEmail !== user.email) {
      try {
        const taskDoc = await getDoc(doc(db, "tasks", targetTaskId));
        if (taskDoc.exists()) {
          const field = tx.isBonus ? "submittedBonusByUserEmails" : "submittedByUserEmails";
          const currentEmails: string[] = taskDoc.data()[field] || [];
          const filtered = currentEmails.filter(e => e.toLowerCase() !== lowerEmail);
          if (filtered.length !== currentEmails.length) {
            await updateDoc(doc(db, "tasks", targetTaskId), { [field]: filtered });
          }
        }
      } catch {
        // Non-critical: ignore cleanup errors
      }
    }
  }

  try {
    const creditMessage = approvedAmount === pendingAmount
      ? `Your request for ${approvedAmount} credits for "${tx.title}" was approved.`
      : `Your request for ${pendingAmount} credits for "${tx.title}" was approved for ${approvedAmount} credits.`;
    await sendNotification(user.email, "Credits Approved", creditMessage, "credits_approved", {
      transactionId: tx.id,
      remarks: remarks || null,
      requestedAmount: pendingAmount,
      awardedAmount: approvedAmount,
    });
  } catch (err) {
    console.error("Notification failed but transaction succeeded:", err);
  }
}

export async function rejectTransaction(user: UserModel, tx: VaultTransaction, remarks?: string, adminName = "Admin") {
  if (!user?.email) throw new Error("Cannot reject: User email is missing.");

  const transactions = user.transactions.map((item) =>
    item.id === tx.id ? {
      ...item,
      status: "rejected" as const,
      adminRemarks: remarks || null,
      adminName: adminName || "Admin"
    } : item,
  );

  const cleanTransactions = JSON.parse(JSON.stringify(transactions));

  await updateDoc(doc(db, "users", user.email.toLowerCase()), {
    transactions: cleanTransactions
  });

  try {
    await sendNotification(user.email, "Credits Rejected", `Your request for ${tx.amount} credits for "${tx.title}" was rejected.`, "credits_rejected", {
      transactionId: tx.id,
      remarks: remarks || null,
    });
  } catch (err) {
    console.error("Notification failed but rejection succeeded:", err);
  }
}

export async function markNotificationRead(userEmail: string, notificationId: string) {
  await updateDoc(doc(db, "users", userEmail.toLowerCase(), "notifications", notificationId), { isRead: true });
}

export async function markAllNotificationsRead(userEmail: string, notifications: AppNotification[]) {
  const batch = writeBatch(db);
  const cleanEmail = userEmail.toLowerCase();
  notifications
    .filter((notification) => !notification.isRead)
    .forEach((notification) => {
      batch.update(doc(db, "users", cleanEmail, "notifications", notification.id), { isRead: true });
    });
  await batch.commit();
}

export async function registerPushNotifications(userEmail: string) {
  try {
    const messagingInstance = await messaging;
    if (!messagingInstance) return;

    const status = await Notification.requestPermission();
    if (status === "granted") {
      const token = await getToken(messagingInstance, {
        vapidKey: "BLf-D6T8-68fV9Q-89h9-89h9-89h9-89h9-89h9-89h9-89h9-89h9" // Replace with your actual VAPID key from Firebase Console
      });

      if (token) {
        await updateDoc(doc(db, "users", userEmail.toLowerCase()), {
          fcmTokens: arrayUnion(token)
        });
      }
    }
  } catch (error) {
    console.error("FCM Registration failed:", error);
  }
}
