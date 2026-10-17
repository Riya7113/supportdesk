import type {
  Comment,
  DashboardStats,
  Organization,
  SessionResponse,
  Ticket,
  TicketDetail,
  TicketPage,
  User,
} from "./types";

const apiRoot = `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""}/api/v1`;
const tokenKey = "supportdesk_access_token";
const organizationKey = "supportdesk_organization";

export function saveSession(session: SessionResponse) {
  localStorage.setItem(tokenKey, session.access_token);
  localStorage.setItem(organizationKey, JSON.stringify(session.organization));
}

export function clearSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(organizationKey);
}

export function savedOrganization(): Organization | null {
  const value = localStorage.getItem(organizationKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as Organization;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(tokenKey);
  const response = await fetch(`${apiRoot}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;
    if (response.status === 401) clearSession();
    throw new Error(payload?.detail ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<SessionResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (input: {
    organization_name: string;
    full_name: string;
    email: string;
    password: string;
  }) => request<SessionResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<{ user: User; organization: Organization }>("/auth/me"),
  dashboard: () => request<DashboardStats>("/dashboard/stats"),
  tickets: (filter: string) => request<TicketPage>(`/tickets${filter ? `?${filter}` : ""}`),
  ticket: (id: string) => request<TicketDetail>(`/tickets/${id}`),
  createTicket: (input: { subject: string; description: string; priority: string }) =>
    request<Ticket>("/tickets", { method: "POST", body: JSON.stringify(input) }),
  updateTicket: (id: string, input: Record<string, string | null>) =>
    request<Ticket>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  comment: (id: string, body: string) =>
    request<Comment>(`/tickets/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  users: () => request<User[]>("/users"),
  createUser: (input: { full_name: string; email: string; password: string }) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(input) }),
};
