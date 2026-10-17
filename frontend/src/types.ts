export type Role = "admin" | "agent";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface SessionResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
  organization: Organization;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by_id: string;
  created_by_name: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  comments: Comment[];
}

export interface TicketPage {
  items: Ticket[];
  total: number;
  skip: number;
  limit: number;
}

export interface DashboardStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  urgent: number;
  recent: Ticket[];
}
