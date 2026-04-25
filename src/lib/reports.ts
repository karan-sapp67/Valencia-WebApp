import { TaskModel, UserModel } from "./types";
import { parseDate } from "./data";

export function generateInternReportCSV(interns: UserModel[], tasks: TaskModel[]) {
  const headers = [
    "Full Name",
    "Email",
    "Role",
    "Credits Earned",
    "Tasks Assigned",
    "Tasks Completed",
    "Bonus Tasks Completed",
    "Completion Rate",
    "Deadlines Missed",
    "Last Activity"
  ];

  const rows = interns.map(intern => {
    // Filter tasks assigned to this specific intern
    const assignedTasks = tasks.filter(t => t.assignedUserEmails.includes(intern.email));

    // Filter tasks completed by this intern
    const completedTasks = tasks.filter(t =>
      t.completedByUserEmails.includes(intern.email) && !t.isOptional
    );

    const bonusTasks = tasks.filter(t =>
      t.completedByUserEmails.includes(intern.email) && t.isOptional
    );

    // Calculate missed deadlines (Assigned tasks that are not completed and are past due date)
    const now = new Date();
    const missedDeadlines = assignedTasks.filter(t => {
      const isCompleted = t.completedByUserEmails.includes(intern.email);
      const isPastDue = parseDate(t.dueDate).getTime() < now.getTime();
      return !isCompleted && isPastDue;
    }).length;

    const completionRate = assignedTasks.length > 0
      ? ((completedTasks.length / assignedTasks.length) * 100).toFixed(1) + "%"
      : "N/A";

    // Find latest submission or activity
    const completionDates = Object.values(intern.completedTaskDates || {}).map(d => parseDate(d).getTime());
    const lastActivity = completionDates.length > 0
      ? new Date(Math.max(...completionDates)).toLocaleDateString()
      : "No activity";

    return [
      intern.fullName,
      intern.email,
      intern.role,
      intern.credits,
      assignedTasks.length,
      completedTasks.length,
      bonusTasks.length,
      completionRate,
      missedDeadlines,
      lastActivity
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `Stitch_Intern_Report_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
