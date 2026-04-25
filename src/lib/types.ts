export interface VaultTransaction {
  id: string;
  title: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  adminRemarks?: string;
  adminName?: string;
}

export interface UserModel {
  email: string;
  password?: string;
  fullName: string;
  role: 'Intern' | 'Admin' | string;
  credits: number;
  profilePictureUrl?: string;
  transactions: VaultTransaction[];
  completedTaskDates: Record<string, string>;
  notificationsEnabled: boolean;
}

export interface TaskModel {
  id: string;
  title: string;
  description: string;
  phase: string;
  taskType: string;
  dueDate: string;
  credits: number;
  bonusAvailable: boolean;
  bonusDescription: string;
  bonusCredits: number;
  isCompleted: boolean;
  isBonusCompleted: boolean;
  submissionDate?: string;
  assignedUserEmails: string[];
  completedByUserEmails: string[];
  order?: number;
  isOptional?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
}
