import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeTask, normalizeUser, parseDate } from "./data";
import { TaskModel, UserModel, VaultTransaction } from "./types";

function matchesEmail(value: string, email: string) {
  return value === email || value.trim().toLowerCase() === email.trim().toLowerCase();
}

function containsEmail(values: string[] = [], email: string) {
  return values.some((value) => matchesEmail(value, email));
}

function isAssignedToIntern(task: TaskModel, intern: UserModel) {
  return task.assignedUserEmails.length === 0 || containsEmail(task.assignedUserEmails, intern.email);
}

function isCompletedByIntern(task: TaskModel, intern: UserModel) {
  return containsEmail(task.completedByUserEmails, intern.email) || Boolean(intern.completedTaskDates?.[task.id]);
}

function submissionDateFor(task: TaskModel, intern: UserModel) {
  const completedAt = intern.completedTaskDates?.[task.id];
  if (completedAt) return parseDate(completedAt);
  return task.submissionDate && containsEmail(task.completedByUserEmails, intern.email)
    ? parseDate(task.submissionDate)
    : null;
}

function sumTransactions(transactions: VaultTransaction[], status: VaultTransaction["status"]) {
  return transactions
    .filter((transaction) => transaction.status === status)
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
}

function approvedBonusTransactions(transactions: VaultTransaction[]) {
  return transactions.filter(
    (transaction) =>
      transaction.status === "approved" &&
      transaction.title.toLowerCase().includes("bonus"),
  );
}

function formatDateTime(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function getLatestReportData() {
  const [usersSnapshot, tasksSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "tasks")),
  ]);

  return {
    interns: usersSnapshot.docs
      .map((snap) => normalizeUser(snap.data(), snap.id))
      .filter((user) => user.role !== "Admin")
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    tasks: tasksSnapshot.docs.map((snap) => normalizeTask(snap.data(), snap.id)),
  };
}

export function generateInternReportCSV(interns: UserModel[], tasks: TaskModel[]) {
  const headers = [
    "Full Name",
    "Email",
    "Role",
    "Current Credit Balance",
    "Approved Credits",
    "Pending Credits",
    "Rejected Credits",
    "Tasks Assigned",
    "Tasks Completed",
    "Active Tasks",
    "Available Bonus Tasks",
    "Approved Bonus Requests",
    "Approved Bonus Credits",
    "Completion Rate (%)",
    "Missed Deadlines",
    "Last Activity"
  ];

  const now = new Date();

  const rows = interns.map(intern => {
    const assignedTasks = tasks.filter((task) => isAssignedToIntern(task, intern));
    const completedTasks = assignedTasks.filter((task) => isCompletedByIntern(task, intern));
    const activeTasks = assignedTasks.length - completedTasks.length;
    const availableBonusTasks = assignedTasks.filter((task) => task.bonusAvailable).length;
    const bonusTransactions = approvedBonusTransactions(intern.transactions);

    const missedDeadlines = assignedTasks.filter((task) => {
      const dueDate = parseDate(task.dueDate);
      const submittedAt = submissionDateFor(task, intern);

      if (submittedAt) return submittedAt.getTime() > dueDate.getTime();
      return dueDate.getTime() < now.getTime();
    }).length;

    const completionRate = assignedTasks.length > 0
      ? ((completedTasks.length / assignedTasks.length) * 100).toFixed(1)
      : "0.0";

    const activityDates = [
      ...Object.values(intern.completedTaskDates || {}),
      ...intern.transactions.map((transaction) => transaction.date),
    ]
      .map((date) => parseDate(date))
      .filter((date) => !Number.isNaN(date.getTime()));

    const lastActivity = activityDates.length > 0
      ? new Date(Math.max(...activityDates.map((date) => date.getTime())))
      : null;

    return [
      intern.fullName,
      intern.email,
      intern.role,
      intern.credits,
      sumTransactions(intern.transactions, "approved"),
      sumTransactions(intern.transactions, "pending"),
      sumTransactions(intern.transactions, "rejected"),
      assignedTasks.length,
      completedTasks.length,
      activeTasks,
      availableBonusTasks,
      bonusTransactions.length,
      bonusTransactions.reduce((total, transaction) => total + Number(transaction.amount || 0), 0),
      completionRate,
      missedDeadlines,
      formatDateTime(lastActivity)
    ];
  });

  const csvContent = [
    headers.map(csvCell).join(","),
    ...rows.map(row => row.map(csvCell).join(","))
  ].join("\r\n");

  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `Stitch_Intern_Report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportLatestInternReportCSV() {
  const { interns, tasks } = await getLatestReportData();
  generateInternReportCSV(interns, tasks);
}
