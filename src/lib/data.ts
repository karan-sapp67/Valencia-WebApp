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
import { auth, db, messaging } from "@/lib/firebase";
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
  completedTaskDates: {},
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

export function normalizeTransaction(raw: Record<string, any>): VaultTransaction {
  // Use a more stable ID if missing to prevent re-normalization issues
  const stableId = raw.id ?? `legacy-${raw.date}-${raw.amount}-${raw.title}`;
  return {
    id: stableId,
    title: raw.title ?? "Credits",
    amount: Number(raw.amount ?? 0),
    date: isoFromUnknown(raw.date),
    status: raw.status ?? "approved",
    adminRemarks: raw.adminRemarks ?? null,
    adminName: raw.adminName ?? null,
  };
}

export function normalizeUser(raw?: Record<string, any>, id?: string): UserModel {
  const data = raw ?? {};
  return {
    ...emptyUser,
    email: data.email ?? id ?? "",
    password: data.password ?? "",
    fullName: data.fullName ?? data.name ?? "Intern",
    role: data.role ?? "Intern",
    credits: Number(data.credits ?? 0),
    profilePictureUrl: data.profilePictureUrl ?? null,
    transactions: Array.isArray(data.transactions)
      ? data.transactions.map((tx: Record<string, any>) => normalizeTransaction(tx))
      : [],
    completedTaskDates: data.completedTaskDates ?? {},
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
    completedByUserEmails: Array.isArray(raw.completedByUserEmails) ? raw.completedByUserEmails : [],
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
    if (!user?.email) {
      setState({ data: null, loading: false });
      return;
    }

    const ref = doc(db, "users", user.email);
    return onSnapshot(
      ref,
      (snap) => {
        setState({ data: snap.exists() ? normalizeUser(snap.data(), snap.id) : null, loading: false });
      },
      (error) => setState({ data: null, loading: false, error: error.message }),
    );
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

    const q = query(collection(db, "users", userEmail, "notifications"), orderBy("timestamp", "desc"));
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
  await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", email), {
    email,
    password,
    fullName,
    role: "Intern",
    credits: 0,
    profilePictureUrl: null,
    transactions: [],
    completedTaskDates: {},
    notificationsEnabled: true,
  });
  await signOut(auth);
}

export async function loginUser(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    // For mobile browsers, popups are often blocked.
    // We'll try popup first, but you can also use signInWithRedirect if preferred.
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (!user.email) return;

    const ref = doc(db, "users", user.email);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: user.email,
        password: "",
        fullName: user.displayName ?? "New Intern",
        role: "Intern",
        credits: 0,
        profilePictureUrl: user.photoURL,
        transactions: [],
        completedTaskDates: {},
        notificationsEnabled: true,
      });
    }
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      // Fallback to redirect if popup is blocked
      await signInWithRedirect(auth, provider);
    } else {
      console.error("Google Login Error:", error);
      throw error;
    }
  }
}

export async function logoutUser() {
  await signOut(auth);
}

export async function sendReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function updateAvatar(email: string, avatarId: string) {
  await updateDoc(doc(db, "users", email), { profilePictureUrl: avatarId });
}

export async function updateFullName(email: string, fullName: string) {
  await updateDoc(doc(db, "users", email), { fullName });
}

export async function toggleNotifications(email: string, enabled: boolean) {
  await updateDoc(doc(db, "users", email), { notificationsEnabled: enabled });
}

export async function requestCredits(user: UserModel, amount: number, title: string) {
  const tx: VaultTransaction = {
    id: crypto.randomUUID(),
    title,
    amount,
    date: new Date().toISOString(),
    status: "pending",
  };

  await updateDoc(doc(db, "users", user.email), {
    transactions: arrayUnion(tx),
  });
}

export async function sendNotification(recipientEmail: string, title: string, message: string, type: string, metadata?: Record<string, unknown>) {
  const userSnap = await getDoc(doc(db, "users", recipientEmail));
  if (userSnap.exists() && userSnap.data().notificationsEnabled === false) return;

  const id = crypto.randomUUID();
  await setDoc(doc(db, "users", recipientEmail, "notifications", id), {
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

export async function markTaskCompleted(user: UserModel, task: TaskModel, isBonus = false) {
  const now = new Date().toISOString();
  await updateDoc(doc(db, "tasks", task.id), {
    completedByUserEmails: arrayUnion(user.email),
    submissionDate: now,
  });
  await updateDoc(doc(db, "users", user.email), {
    [`completedTaskDates.${task.id}`]: now,
  });

  const finalCredits = parseDate(task.dueDate).getTime() < Date.now() ? Math.round(task.credits / 2) : task.credits;
  await requestCredits(
    user,
    isBonus ? task.bonusCredits : finalCredits,
    `Completed: ${isBonus ? "Bonus Task" : task.title}${finalCredits < task.credits ? " (Late Submission)" : ""}`,
  );
  await broadcastToAdmins("Task Completed", `${user.fullName} completed "${task.title}".`, "review_needed", {
    taskId: task.id,
    internEmail: user.email,
  });
}

export async function addTask(task: TaskModel) {
  await setDoc(doc(db, "tasks", task.id), task);
  const interns = await getDocs(query(collection(db, "users"), where("role", "==", "Intern")));
  await Promise.all(
    interns.docs.map((snap) =>
      sendNotification(
        snap.id,
        "New Task Assigned",
        `A new task "${task.title}" has been added to ${task.phase}. Check it out!`,
        "task_new",
        { taskId: task.id },
      ),
    ),
  );
}

export async function updateTask(task: TaskModel) {
  await updateDoc(doc(db, "tasks", task.id), task as unknown as Record<string, unknown>);
}

export async function deleteTask(taskId: string) {
  await deleteDoc(doc(db, "tasks", taskId));
}

export async function approveTransaction(user: UserModel, tx: VaultTransaction, remarks?: string, adminName = "Admin") {
  if (!user?.email) throw new Error("Cannot approve: User email is missing.");

  const transactions = user.transactions.map((item) =>
    item.id === tx.id ? {
      ...item,
      status: "approved" as const,
      adminRemarks: remarks || null,
      adminName: adminName || "Admin"
    } : item,
  );

  // Firestore does not accept 'undefined'. We use JSON stringify/parse to strip any accidental undefineds.
  const cleanTransactions = JSON.parse(JSON.stringify(transactions));

  await updateDoc(doc(db, "users", user.email), {
    transactions: cleanTransactions,
    credits: increment(Number(tx.amount) || 0),
  });

  try {
    await sendNotification(user.email, "Credits Approved", `Your request for ${tx.amount} credits for "${tx.title}" was approved.`, "credits_approved", {
      transactionId: tx.id,
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

  await updateDoc(doc(db, "users", user.email), {
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
  await updateDoc(doc(db, "users", userEmail, "notifications", notificationId), { isRead: true });
}

export async function markAllNotificationsRead(userEmail: string, notifications: AppNotification[]) {
  const batch = writeBatch(db);
  notifications
    .filter((notification) => !notification.isRead)
    .forEach((notification) => {
      batch.update(doc(db, "users", userEmail, "notifications", notification.id), { isRead: true });
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
        await updateDoc(doc(db, "users", userEmail), {
          fcmTokens: arrayUnion(token)
        });
      }
    }
  } catch (error) {
    console.error("FCM Registration failed:", error);
  }
}
