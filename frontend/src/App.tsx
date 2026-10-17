import { useEffect, useState } from "react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { api, clearSession, saveSession, savedOrganization } from "./api";
import type {
  DashboardStats,
  Organization,
  SessionResponse,
  Ticket,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  User,
} from "./types";

type Page = "overview" | "tickets" | "team";

const pageCopy: Record<Page, { title: string; subtitle: string }> = {
  overview: { title: "Overview", subtitle: "A quick look at your support desk." },
  tickets: { title: "All tickets", subtitle: "Track every conversation in one place." },
  team: { title: "Your team", subtitle: "Manage the people supporting your customers." },
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: TicketStatus) {
  return status === "in_progress" ? "In progress" : status[0].toUpperCase() + status.slice(1);
}

function Badge({ children, tone }: { children: string; tone: "blue" | "amber" | "green" | "red" | "slate" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/15",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    red: "bg-rose-50 text-rose-700 ring-rose-600/15",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const tone = status === "resolved" ? "green" : status === "in_progress" ? "blue" : "amber";
  return <Badge tone={tone}>{statusLabel(status)}</Badge>;
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const tone = priority === "urgent" ? "red" : priority === "high" ? "amber" : priority === "low" ? "slate" : "blue";
  return <Badge tone={tone}>{priority[0].toUpperCase() + priority.slice(1)}</Badge>;
}

function AuthScreen({ onSignedIn }: { onSignedIn: (session: SessionResponse) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    try {
      const session =
        mode === "register"
          ? await api.register({
              organization_name: String(values.get("organization") ?? "").trim(),
              full_name: String(values.get("name") ?? "").trim(),
              email,
              password,
            })
          : await api.login(email, password);
      saveSession(session);
      onSignedIn(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#f5f7fb] text-slate-900">
      <section className="hidden w-[46%] flex-col justify-between bg-[#101c34] p-12 text-white lg:flex">
        <div>
          <Brand light />
          <div className="mt-28 max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">Customer support, made clear</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.12] tracking-tight">Every customer deserves a thoughtful answer.</h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">A calm, organized place for your team to keep conversations moving.</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">SupportDesk · A workspace for better support</p>
      </section>
      <section className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <p className="text-sm font-semibold text-blue-700">WELCOME TO SUPPORTDESK</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{mode === "login" ? "Sign in to your workspace" : "Create your workspace"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "login" ? "Pick up where your team left off." : "Start organizing customer conversations today."}
          </p>
          <form className="mt-8 space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <>
                <Field label="Workspace name" name="organization" placeholder="Northstar Studio" required minLength={2} />
                <Field label="Your name" name="name" placeholder="Riya Singh" required minLength={2} />
              </>
            )}
            <Field label="Email address" name="email" type="email" placeholder="you@company.com" required autoComplete="email" />
            <Field label="Password" name="password" type="password" placeholder={mode === "register" ? "At least 12 characters" : "Your password"} required minLength={mode === "register" ? 12 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} />
            {error && <InlineAlert message={error} />}
            <button className="mt-2 flex w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create workspace"}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">
            {mode === "login" ? "New to SupportDesk?" : "Already have a workspace?"}{" "}
            <button className="font-semibold text-blue-700 hover:text-blue-900" onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
          <p className="mt-14 text-center text-xs text-slate-400">Thoughtful support starts with a clear view.</p>
        </div>
      </section>
    </main>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-xl font-bold text-white">S</span>
      <span className={`text-xl font-semibold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>SupportDesk</span>
    </div>
  );
}

function Field({ label, name, type = "text", ...props }: { label: string; name: string; type?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input name={name} type={type} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" {...props} />
    </label>
  );
}

function InlineAlert({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(() => savedOrganization());
  const [page, setPage] = useState<Page>("overview");
  const [booting, setBooting] = useState(Boolean(localStorage.getItem("supportdesk_access_token")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ticketRows, setTicketRows] = useState<Ticket[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("supportdesk_access_token")) return;
    api.me()
      .then((account) => {
        setUser(account.user);
        setOrganization(account.organization);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      setBusy(true);
      try {
        if (page === "overview") {
          const result = await api.dashboard();
          if (active) setStats(result);
        } else if (page === "tickets") {
          const params = new URLSearchParams();
          if (statusFilter) params.set("status", statusFilter);
          if (search.trim()) params.set("search", search.trim());
          const result = await api.tickets(params.toString());
          if (active) setTicketRows(result.items);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load this page.");
      } finally {
        if (active) setBusy(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, page, statusFilter, search]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let active = true;
    api.users()
      .then((result) => { if (active) setTeam(result); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load your team.");
      });
    return () => { active = false; };
  }, [user]);

  function onSignedIn(session: SessionResponse) {
    setUser(session.user);
    setOrganization(session.organization);
    setPage("overview");
  }

  function signOut() {
    clearSession();
    setUser(null);
    setOrganization(null);
    setStats(null);
    setTicketRows([]);
    setTeam([]);
    setSelectedTicket(null);
  }

  async function openTicket(ticket: Ticket) {
    setError("");
    try {
      setSelectedTicket(await api.ticket(ticket.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open this ticket.");
    }
  }

  async function refreshSelectedTicket() {
    if (!selectedTicket) return;
    setSelectedTicket(await api.ticket(selectedTicket.id));
    if (page === "tickets") {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      setTicketRows((await api.tickets(params.toString())).items);
    }
    if (page === "overview") setStats(await api.dashboard());
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const ticket = await api.createTicket({
        subject: String(values.get("subject") ?? "").trim(),
        description: String(values.get("description") ?? "").trim(),
        priority: String(values.get("priority") ?? "normal"),
      });
      setShowTicketForm(false);
      setPage("tickets");
      setStatusFilter("");
      setSearch("");
      setSelectedTicket(await api.ticket(ticket.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.createUser({
        full_name: String(values.get("name") ?? "").trim(),
        email: String(values.get("email") ?? "").trim(),
        password: String(values.get("password") ?? ""),
      });
      setShowMemberForm(false);
      setTeam(await api.users());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this teammate.");
    } finally {
      setBusy(false);
    }
  }

  if (booting) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading your workspace…</div>;
  if (!user) return <AuthScreen onSignedIn={onSignedIn} />;

  const copy = pageCopy[page];
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-5 py-6 lg:flex">
        <Brand />
        <div className="mt-10 rounded-xl bg-slate-50 px-3 py-3">
          <p className="truncate text-sm font-semibold text-slate-800">{organization?.name ?? "Your workspace"}</p>
          <p className="mt-0.5 text-xs text-slate-500">{user.role === "admin" ? "Workspace admin" : "Support agent"}</p>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Main navigation">
          <NavButton active={page === "overview"} onClick={() => setPage("overview")} symbol="▦">Overview</NavButton>
          <NavButton active={page === "tickets"} onClick={() => setPage("tickets")} symbol="▤">Tickets</NavButton>
          {user.role === "admin" && <NavButton active={page === "team"} onClick={() => setPage("team")} symbol="♙">Team</NavButton>}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-5">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.full_name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <button aria-label="Sign out" title="Sign out" onClick={signOut} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">↗</button>
          </div>
          <p className="mt-5 text-center text-[11px] text-slate-400">SupportDesk · Riya Singh</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-[#f5f7fb]/95 px-5 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="lg:hidden"><Brand /></div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
                <p className="mt-0.5 text-sm text-slate-500">{copy.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {page === "tickets" && <button onClick={() => setShowTicketForm(true)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">+ <span className="hidden sm:inline">New ticket</span><span className="sm:hidden">New</span></button>}
              <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 lg:hidden">Sign out</button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-7 md:px-8 md:py-9">
          <div className="mb-6 lg:hidden">
            <h1 className="text-xl font-semibold">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setPage("overview")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === "overview" ? "bg-blue-700 text-white" : "bg-white text-slate-600"}`}>Overview</button>
              <button onClick={() => setPage("tickets")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === "tickets" ? "bg-blue-700 text-white" : "bg-white text-slate-600"}`}>Tickets</button>
              {user.role === "admin" && <button onClick={() => setPage("team")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === "team" ? "bg-blue-700 text-white" : "bg-white text-slate-600"}`}>Team</button>}
            </div>
          </div>
          {error && <div className="mb-6"><InlineAlert message={error} /></div>}
          {page === "overview" && <Overview stats={stats} busy={busy} onNew={() => setShowTicketForm(true)} onOpen={openTicket} onAllTickets={() => setPage("tickets")} />}
          {page === "tickets" && <TicketList rows={ticketRows} busy={busy} status={statusFilter} search={search} onStatus={setStatusFilter} onSearch={setSearch} onOpen={openTicket} onNew={() => setShowTicketForm(true)} />}
          {page === "team" && <TeamList members={team} busy={busy} onAdd={() => setShowMemberForm(true)} />}
        </main>
      </div>

      {showTicketForm && <Modal title="Create a ticket" subtitle="Capture the question and give your team a place to respond." error={error} onClose={() => setShowTicketForm(false)}>
        <form onSubmit={createTicket} className="space-y-4">
          <Field label="Subject" name="subject" placeholder="What does the customer need help with?" required minLength={3} maxLength={200} />
          <label className="block text-sm font-medium text-slate-700">Details<textarea name="description" rows={5} required minLength={5} maxLength={20000} placeholder="Add the context your team needs to get started…" className="mt-2 block w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label>
          <SelectField label="Priority" name="priority" options={[["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]]} />
          <FormActions busy={busy} submitLabel="Create ticket" onCancel={() => setShowTicketForm(false)} />
        </form>
      </Modal>}

      {showMemberForm && <Modal title="Add a teammate" subtitle="Create an agent account for someone in your organization." error={error} onClose={() => setShowMemberForm(false)}>
        <form onSubmit={addMember} className="space-y-4">
          <Field label="Full name" name="name" placeholder="Alex Morgan" required minLength={2} />
          <Field label="Email address" name="email" type="email" placeholder="alex@company.com" required />
          <Field label="Temporary password" name="password" type="password" placeholder="At least 12 characters" required minLength={12} />
          <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">Share this temporary password with your teammate through a secure channel. Email invitations are not configured yet.</p>
          <FormActions busy={busy} submitLabel="Add teammate" onCancel={() => setShowMemberForm(false)} />
        </form>
      </Modal>}

      {selectedTicket && <TicketDialog ticket={selectedTicket} members={team} isAdmin={user.role === "admin"} onClose={() => setSelectedTicket(null)} onChanged={refreshSelectedTicket} />}
    </div>
  );
}

function NavButton({ active, onClick, symbol, children }: { active: boolean; onClick: () => void; symbol: string; children: string }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><span className={`grid h-6 w-6 place-items-center rounded-md ${active ? "bg-white text-blue-700" : "text-slate-400"}`}>{symbol}</span>{children}</button>;
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-blue-100 font-semibold text-blue-800 ${small ? "h-8 w-8 text-xs" : "h-9 w-9 text-xs"}`}>{initials(name)}</span>;
}

function Overview({ stats, busy, onNew, onOpen, onAllTickets }: { stats: DashboardStats | null; busy: boolean; onNew: () => void; onOpen: (ticket: Ticket) => void; onAllTickets: () => void }) {
  const cards = [
    { label: "Open tickets", value: stats?.open ?? 0, caption: "Waiting for a reply", tone: "amber", symbol: "◷" },
    { label: "In progress", value: stats?.in_progress ?? 0, caption: "Being handled by your team", tone: "blue", symbol: "↗" },
    { label: "Resolved", value: stats?.resolved ?? 0, caption: "Marked as complete", tone: "green", symbol: "✓" },
    { label: "Urgent", value: stats?.urgent ?? 0, caption: "Needs a closer look", tone: "red", symbol: "!" },
  ];
  const cardTone: Record<string, string> = { amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", red: "bg-rose-50 text-rose-700" };
  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-blue-700">YOUR SUPPORT DESK</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Good work starts with a clear queue.</h2><p className="mt-1 text-sm text-slate-500">Here is what is happening across your workspace.</p></div>
      <button onClick={onNew} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">+ New ticket</button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => <section key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30">
        <div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{card.label}</p><span className={`grid h-9 w-9 place-items-center rounded-xl text-lg font-semibold ${cardTone[card.tone]}`}>{card.symbol}</span></div>
        <p className="mt-5 text-3xl font-semibold tracking-tight">{busy && !stats ? "—" : card.value}</p><p className="mt-1 text-xs text-slate-400">{card.caption}</p>
      </section>)}
    </div>
    <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-6"><div><h3 className="font-semibold">Recently updated</h3><p className="mt-0.5 text-xs text-slate-500">The latest conversations from your team</p></div><button onClick={onAllTickets} className="text-sm font-semibold text-blue-700 hover:text-blue-900">View all tickets →</button></div>
      {stats?.recent.length ? <div className="divide-y divide-slate-100">{stats.recent.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={onOpen} />)}</div> : <EmptyState loading={busy} title="Your queue is clear" message="Create a ticket to start tracking a customer conversation." action="Create ticket" onAction={onNew} />}
    </section>
  </>;
}

function TicketList({ rows, busy, status, search, onStatus, onSearch, onOpen, onNew }: { rows: Ticket[]; busy: boolean; status: string; search: string; onStatus: (value: string) => void; onSearch: (value: string) => void; onOpen: (ticket: Ticket) => void; onNew: () => void }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
      <div><h2 className="font-semibold">Ticket queue</h2><p className="mt-0.5 text-xs text-slate-500">{busy ? "Loading…" : `${rows.length} ${rows.length === 1 ? "conversation" : "conversations"} on this page`}</p></div>
      <div className="flex w-full gap-2 sm:w-auto">
        <input aria-label="Search tickets" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search subject…" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-52" />
        <select aria-label="Filter by status" value={status} onChange={(event) => onStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select>
      </div>
    </div>
    {rows.length ? <div className="divide-y divide-slate-100">{rows.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={onOpen} />)}</div> : <EmptyState loading={busy} title="No tickets found" message={search || status ? "Try changing your filters, or start a new conversation." : "Tickets created by your team will appear here."} action="Create ticket" onAction={onNew} />}
  </section>;
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: (ticket: Ticket) => void }) {
  return <button onClick={() => onOpen(ticket)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_150px_120px_130px] md:px-6">
    <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{ticket.subject}</p><p className="mt-1 truncate text-xs text-slate-500">Opened by {ticket.created_by_name} · {dateLabel(ticket.updated_at)}</p></div>
    <div className="hidden md:block"><StatusBadge status={ticket.status} /></div><div className="hidden md:block"><PriorityBadge priority={ticket.priority} /></div>
    <span className="text-right text-xs text-slate-500 md:text-left">{ticket.assigned_to_name ? `With ${ticket.assigned_to_name.split(" ")[0]}` : "Unassigned"}<span className="ml-2 text-slate-300">→</span></span>
    <div className="col-span-2 flex gap-2 md:hidden"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
  </button>;
}

function TeamList({ members, busy, onAdd }: { members: User[]; busy: boolean; onAdd: () => void }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-6"><div><h2 className="font-semibold">Workspace members</h2><p className="mt-0.5 text-xs text-slate-500">{members.length} {members.length === 1 ? "person" : "people"} in your support team</p></div><button onClick={onAdd} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">+ Add teammate</button></div>
    {members.length ? <div className="divide-y divide-slate-100">{members.map((member) => <div key={member.id} className="flex items-center gap-3 px-5 py-4 md:px-6"><Avatar name={member.full_name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.full_name}</p><p className="truncate text-xs text-slate-500">{member.email}</p></div><Badge tone={member.role === "admin" ? "blue" : "slate"}>{member.role === "admin" ? "Admin" : "Agent"}</Badge><Badge tone={member.is_active ? "green" : "red"}>{member.is_active ? "Active" : "Inactive"}</Badge></div>)}</div> : <EmptyState loading={busy} title="Your team starts here" message="Add an agent so more people can help customers." action="Add teammate" onAction={onAdd} />}
  </section>;
}

function EmptyState({ loading, title, message, action, onAction }: { loading: boolean; title: string; message: string; action: string; onAction: () => void }) {
  return <div className="flex flex-col items-center px-6 py-14 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-xl text-blue-700">{loading ? "…" : "✦"}</span><h3 className="mt-4 text-sm font-semibold">{loading ? "Loading your workspace" : title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{loading ? "Just a moment while we gather the latest information." : message}</p>{!loading && <button onClick={onAction} className="mt-4 text-sm font-semibold text-blue-700 hover:text-blue-900">{action} →</button>}</div>;
}

function Modal({ title, subtitle, error, onClose, children }: { title: string; subtitle: string; error?: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button></div>
      <div className="mt-6 space-y-4">{error && <InlineAlert message={error} />}{children}</div>
    </section>
  </div>;
}

function SelectField({ label, name, options }: { label: string; name: string; options: [string, string][] }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<select name={name} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">{options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>;
}

function FormActions({ busy, submitLabel, onCancel }: { busy: boolean; submitLabel: string; onCancel: () => void }) {
  return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={busy} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? "Saving…" : submitLabel}</button></div>;
}

function TicketDialog({ ticket, members, isAdmin, onClose, onChanged }: { ticket: TicketDetail; members: User[]; isAdmin: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  async function update(input: Record<string, string | null>) {
    setBusy(true);
    setDialogError("");
    try {
      await api.updateTicket(ticket.id, input);
      await onChanged();
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : "Could not update this ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    setDialogError("");
    try {
      await api.comment(ticket.id, comment.trim());
      setComment("");
      await onChanged();
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : "Could not add your reply.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={ticket.subject} subtitle={`Opened by ${ticket.created_by_name} · ${dateLabel(ticket.created_at)}`} error={dialogError} onClose={onClose}>
    <div className="flex flex-wrap gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
    <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{ticket.description}</p>
    <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status<select disabled={busy} value={ticket.status} onChange={(event) => void update({ status: event.target.value })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label>
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority<select disabled={busy} value={ticket.priority} onChange={(event) => void update({ priority: event.target.value })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
      {isAdmin && <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">Assigned to<select disabled={busy} value={ticket.assigned_to_id ?? ""} onChange={(event) => void update({ assigned_to_id: event.target.value || null })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"><option value="">Unassigned</option>{members.filter((member) => member.is_active).map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>}
    </div>
    <div className="mt-7"><h3 className="text-sm font-semibold">Conversation <span className="ml-1 font-normal text-slate-400">{ticket.comments.length}</span></h3>
      {ticket.comments.length ? <div className="mt-3 space-y-3">{ticket.comments.map((entry) => <article key={entry.id} className="rounded-xl border border-slate-100 p-3.5"><div className="flex items-center gap-2"><Avatar name={entry.author_name} small /><span className="text-xs font-semibold">{entry.author_name}</span><span className="text-xs text-slate-400">{dateLabel(entry.created_at)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.body}</p></article>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">No replies yet. Add the first update below.</p>}
    </div>
    <form onSubmit={sendComment} className="mt-5"><label className="block text-sm font-medium text-slate-700">Add a reply<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={10000} placeholder="Write a helpful update…" className="mt-2 block w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label><div className="mt-3 flex justify-end"><button disabled={busy || !comment.trim()} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Send reply"}</button></div></form>
  </Modal>;
}

export default App;
