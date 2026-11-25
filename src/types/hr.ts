export type UserRole = "admin" | "hr_manager" | "branch_lead" | "employee";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveType =
  | "annual"
  | "sick"
  | "unpaid"
  | "maternity_paternity"
  | "other";

export type EmploymentStatus = "active" | "on_leave" | "probation" | "terminated";

export interface Branch {
  id: string;
  code: string;
  name: string;
  is_hq: boolean;
  location: string;
  target_headcount: number;
  created_at: string;
}

export interface Profile {
  id: string;
  employee_id: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  position_title: string;
  department: string;
  branch_id: string;
  status: EmploymentStatus;
  hire_date: string;
  annual_leave_quota: number;
  used_leave_days: number;
  salary_grade: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  branch_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: LeaveStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}
