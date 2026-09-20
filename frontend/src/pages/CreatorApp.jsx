import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3, Heart, Users, Bell, ArrowDownLeft, Mail, SlidersHorizontal, ArrowRight,
  Search, AlertTriangle, Clock, BadgeCheck, Pencil, Send, Leaf, Crown, Diamond, ChevronRight, ChevronLeft, Plus, X, Check,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

/* ------------------------- Administrator override sheet ------------------------- */
const OVERRIDE_ACTIONS = [
  { key: "restore_access", label: "Restore Access", cls: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  { key: "suspend_account", label: "Suspend Account", cls: "bg-amber-400 hover:bg-amber-500 text-white" },
  { key: "approve_payment_plan", label: "Approve Payment Plan", cls: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  { key: "terminate_account", label: "Terminate Account", cls: "bg-primary hover:bg-primary/90 text-white" },
];

function OverrideSheet({ sub, onClose, onConfirm }) {
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const statusColor = sub.status === "paid" ? "text-emerald-600" : sub.status === "due" ? "text-amber-500" : "text-primary";
  const canConfirm = action && reason.trim();

  return (
    <div className="p-6" data-testid="override-sheet">
      <button data-testid="override-close" onClick={onClose}
        className="rounded-full bg-card px-5 py-2 font-semibold text-primary shadow-jade hover:bg-muted">Close</button>

      <div className="mt-4 flex flex-col items-center text-center">
        <Avatar initials={sub.initials} />
        <h2 className="mt-3 font-display text-3xl font-bold">{sub.name}</h2>
        <p className="text-muted-foreground">{sub.handle}</p>
      </div>

      <div className="mt-5 rounded-3xl bg-card p-5 shadow-jade">
        <div className="flex items-center justify-between py-1"><span className="text-muted-foreground">Plan</span><span className="font-bold">{sub.plan_name}</span></div>
        <div className="flex items-center justify-between py-1"><span className="text-muted-foreground">Amount</span><span className="font-bold">${sub.amount}</span></div>
        <div className="flex items-center justify-between py-1"><span className="text-muted-foreground">Status</span><span className={`font-bold capitalize ${statusColor}`}>{sub.status}</span></div>
      </div>

      <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-primary">Administrator Override</p>
      <p className="mt-1 text-sm text-muted-foreground">Select an action. A reason is required before confirming.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {OVERRIDE_ACTIONS.map((a) => (
          <button key={a.key} data-testid={`override-${a.key}`} onClick={() => setAction(a.key)}
            className={`rounded-2xl py-3.5 text-sm font-bold transition-all ${a.cls} ${action === a.key ? "ring-4 ring-primary/30 -translate-y-0.5" : ""}`}>
            {a.label}
          </button>
        ))}
      </div>

      <Textarea data-testid="override-reason" value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Enter a reason for this action…" className="mt-4 min-h-[90px] rounded-2xl bg-primary/5 border-transparent" />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button data-testid="override-confirm" disabled={!canConfirm}
          onClick={() => onConfirm(sub.id, action, reason.trim())}
          className="h-12 rounded-full text-base">Confirm Action</Button>
        <Button data-testid="override-cancel" onClick={onClose} variant="outline" className="h-12 rounded-full bg-card">Cancel</Button>
      </div>
    </div>
  );
}


/* ---------------------------------- shared --------------------------------- */
const Avatar = ({ initials }) => (
  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
    {initials}
  </span>
);

const PLAN_ICON = {
  leaf: { Icon: Leaf, bg: "bg-emerald-100", fg: "text-emerald-600" },
  crown: { Icon: Crown, bg: "bg-amber-100", fg: "text-amber-500" },
  diamond: { Icon: Diamond, bg: "bg-primary/15", fg: "text-primary" },
};

const STATUS = {
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-700", Icon: BadgeCheck },
  due: { label: "Due", cls: "bg-amber-100 text-amber-600", Icon: Clock },
  overdue: { label: "Overdue", cls: "bg-primary/10 text-primary", Icon: AlertTriangle },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.due;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${s.cls}`}>
      <s.Icon className="h-4 w-4" /> {s.label}
    </span>
  );
}

const REMIND_COLORS = {
  amber: { dot: "bg-amber-400", label: "text-amber-500", all: "bg-amber-400 text-white", btn: "bg-amber-100 text-amber-600 hover:bg-amber-200" },
  green: { dot: "bg-emerald-500", label: "text-emerald-600", all: "bg-emerald-500 text-white", btn: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  pink: { dot: "bg-primary", label: "text-primary", all: "bg-primary text-white", btn: "bg-primary/10 text-primary hover:bg-primary/20" },
};

/* -------------------------------- HOME TAB --------------------------------- */
function HomeTab({ go }) {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [price, setPrice] = useState("");

  const load = () => api.get("/creator/home").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const savePrice = async () => {
    await api.patch(`/creator/plans/${editing.id}`, { price: Number(price) });
    setEditing(null);
    toast.success("Plan updated.");
    load();
  };

  if (!data) return <Loader />;

  return (
    <div className="space-y-6">
      <TitleBar title="Jade & Co" />

      {/* pending admin requests */}
      {data.pending_requests > 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-[#b01049] to-[#c11a54] p-5 text-white shadow-jade-lg" data-testid="pending-requests-banner">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-6 w-6" />
            <div className="flex-1">
              <p className="text-lg font-bold">Pending Admin Requests</p>
              <p className="text-sm text-white/80">{data.pending_requests} fans are waiting on your approval</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-bold text-primary">{data.pending_requests}</span>
          </div>
          <button data-testid="review-requests-btn" onClick={() => go("requests")}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 font-bold text-primary transition-transform hover:-translate-y-0.5">
            Review Requests <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* revenue overview */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Revenue overview</p>
          <p className="text-sm text-muted-foreground">This month</p>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#a80f47] via-[#c11a54] to-[#d63768] p-7 text-white shadow-jade-lg" data-testid="revenue-card">
          <div className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="relative text-sm font-semibold text-white/85">Total earnings</p>
          <p className="relative mt-1 font-display text-6xl font-bold">${data.revenue_total}</p>
          <p className="relative mt-3 text-white/80">Across all active tribute plans</p>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-card p-5 shadow-jade" data-testid="stat-active-subs">
          <Users className="h-5 w-5 text-primary" />
          <p className="mt-3 font-display text-3xl font-bold">{data.stats.active_subscribers}</p>
          <p className="text-sm text-muted-foreground">Active subscribers</p>
        </div>
        <div className="rounded-3xl bg-card p-5 shadow-jade" data-testid="stat-payments-week">
          <BarChart3 className="h-5 w-5 text-primary" />
          <p className="mt-3 font-display text-3xl font-bold">{data.stats.payments_this_week}</p>
          <p className="text-sm text-muted-foreground">Payments this week</p>
        </div>
      </div>

      {/* recent payments */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">Recent payments</p>
        <div className="rounded-3xl bg-card p-2 shadow-jade" data-testid="recent-payments">
          {data.recent_payments.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-3.5 px-3 py-3.5 ${i > 0 ? "border-t border-border/70" : ""}`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <ArrowDownLeft className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-muted-foreground">{p.method} · {p.when}</p>
              </div>
              <p className="text-lg font-bold text-emerald-600">+${p.amount}</p>
            </div>
          ))}
        </div>
      </div>

      {/* plans */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your plans</p>
          <p className="text-sm text-muted-foreground">{data.plans_active} active</p>
        </div>
        <div className="space-y-3" data-testid="your-plans">
          {data.plans.map((pl) => {
            const ic = PLAN_ICON[pl.icon] || PLAN_ICON.diamond;
            return (
              <div key={pl.id} className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-jade" data-testid={`plan-${pl.id}`}>
                <span className={`grid h-12 w-12 place-items-center rounded-full ${ic.bg} ${ic.fg}`}>
                  <ic.Icon className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <p className="text-lg font-bold">{pl.name}</p>
                  <p className="text-sm text-muted-foreground">{pl.subscribers} subscribed · {pl.cadence}</p>
                </div>
                <p className="font-display text-xl font-bold text-primary">${pl.price}</p>
                <button data-testid={`edit-plan-${pl.id}`} onClick={() => { setEditing(pl); setPrice(String(pl.price)); }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* footer actions */}
      <div className="space-y-3">
        <button data-testid="view-fan-inbox" onClick={() => go("inbox")}
          className="flex w-full items-center gap-3 rounded-3xl bg-card p-4 font-bold text-primary shadow-jade transition-transform hover:-translate-y-0.5">
          <Mail className="h-5 w-5" /> View Fan Inbox <ArrowRight className="ml-auto h-5 w-5" />
        </button>
        <button data-testid="manage-plans" onClick={() => go("tribute")}
          className="flex w-full items-center gap-3 rounded-3xl bg-card p-4 font-bold text-primary shadow-jade transition-transform hover:-translate-y-0.5">
          <SlidersHorizontal className="h-5 w-5" /> Manage Plans <ArrowRight className="ml-auto h-5 w-5" />
        </button>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle className="font-display">Edit {editing?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Tribute price ($)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
              <Input data-testid="edit-plan-price" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)}
                className="h-12 rounded-2xl bg-white pl-8 text-lg" />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="save-plan-price" onClick={savePrice} className="w-full rounded-full">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- TRIBUTE TAB ------------------------------- */
function TributeTab() {
  const [plans, setPlans] = useState(null);
  const [editing, setEditing] = useState(null);
  const [price, setPrice] = useState("");

  const load = () => api.get("/creator/home").then((r) => setPlans(r.data.plans));
  useEffect(() => { load(); }, []);

  const savePrice = async () => {
    await api.patch(`/creator/plans/${editing.id}`, { price: Number(price) });
    setEditing(null); toast.success("Plan updated."); load();
  };

  if (!plans) return <Loader />;
  return (
    <div className="space-y-6">
      <TitleBar title="Tribute Plans" />
      <p className="text-center text-muted-foreground -mt-2">The offerings your subjects may pledge.</p>
      <div className="space-y-3" data-testid="tribute-plans">
        {plans.map((pl) => {
          const ic = PLAN_ICON[pl.icon] || PLAN_ICON.diamond;
          return (
            <div key={pl.id} className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-jade">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${ic.bg} ${ic.fg}`}>
                <ic.Icon className="h-7 w-7" />
              </span>
              <div className="flex-1">
                <p className="text-lg font-bold">{pl.name}</p>
                <p className="text-sm text-muted-foreground">{pl.subscribers} subscribed · {pl.cadence}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold text-primary">${pl.price}</p>
                <button data-testid={`tribute-edit-${pl.id}`} onClick={() => { setEditing(pl); setPrice(String(pl.price)); }}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle className="font-display">Edit {editing?.name}</DialogTitle></DialogHeader>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
            <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 rounded-2xl bg-white pl-8 text-lg" />
          </div>
          <DialogFooter><Button onClick={savePrice} className="w-full rounded-full">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- SUBS TAB -------------------------------- */
const FILTERS = ["All", "Paid", "Due", "Overdue"];
function SubsTab() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);

  const load = () => api.get("/creator/subscribers").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    await api.post(`/creator/subscribers/${id}/status`, { status });
    setActive(null); toast.success("Subscriber updated."); load();
  };
  const remind = async (id) => {
    const { data: res } = await api.post(`/creator/subscribers/${id}/remind`);
    setActive(null); toast.success(res.message);
  };
  const override = async (id, action, reason) => {
    const { data: res } = await api.post(`/creator/subscribers/${id}/override`, { action, reason });
    setActive(null); toast.success(res.message); load();
  };
  const messageAll = async () => { const { data: r } = await api.post("/creator/message-all"); toast.success(`Message sent to ${r.sent} subscribers.`); };
  const remindOverdue = async () => { const { data: r } = await api.post("/creator/remind-group/overdue"); toast.success(`Reminded ${r.reminded} overdue subscribers.`); };
  const markUnpaid = async () => { await api.post("/creator/mark-all-unpaid"); toast.message("All marked unpaid."); load(); };

  if (!data) return <Loader />;
  const list = data.subscribers.filter((s) =>
    (filter === "All" || s.status === filter.toLowerCase()) &&
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <TitleBar title="Manage Subscribers" />
      {data.missed_count > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-primary/10 px-4 py-3 text-primary" data-testid="missed-banner">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">{data.missed_count} subscribers missed a tribute</span>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input data-testid="subs-search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subscribers by name" className="h-13 rounded-full bg-card pl-12 shadow-jade border-transparent" />
      </div>
      <div className="flex gap-2.5">
        {FILTERS.map((f) => (
          <button key={f} data-testid={`filter-${f.toLowerCase()}`} onClick={() => setFilter(f)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
              filter === f ? "bg-primary text-primary-foreground shadow-jade" : "bg-card text-foreground"
            }`}>{f}</button>
        ))}
      </div>

      <div className="space-y-3" data-testid="subs-list">
        {list.map((s) => (
          <button key={s.id} data-testid={`sub-${s.id}`} onClick={() => setActive(s)}
            className="flex w-full items-center gap-3.5 rounded-3xl bg-card p-4 text-left shadow-jade transition-transform hover:-translate-y-0.5">
            <Avatar initials={s.initials} />
            <div className="flex-1">
              <p className="text-lg font-bold">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.plan_name} · ${s.amount}</p>
            </div>
            <StatusBadge status={s.status} />
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
        {list.length === 0 && <p className="py-8 text-center text-muted-foreground">No subscribers match.</p>}
      </div>

      <div className="space-y-3 pt-2">
        <Button data-testid="send-message-all" onClick={messageAll}
          className="h-14 w-full rounded-full bg-gradient-to-r from-[#c11a54] to-[#FF4E88] text-base shadow-jade-lg transition-transform hover:-translate-y-0.5">
          <Send className="mr-2 h-5 w-5" /> Send Message to All
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button data-testid="remind-all-overdue" onClick={remindOverdue} variant="ghost"
            className="h-12 rounded-full bg-primary/10 font-bold text-primary hover:bg-primary/20">Remind All Overdue</Button>
          <Button data-testid="mark-all-unpaid" onClick={markUnpaid} variant="outline"
            className="h-12 rounded-full bg-card">Mark All Unpaid</Button>
        </div>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Subscriber actions</DialogTitle></DialogHeader>
          {active && <OverrideSheet sub={active} onClose={() => setActive(null)} onConfirm={override} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------- REMIND TAB ------------------------------- */
function ReminderRow({ s, color, onRemind }) {
  const c = REMIND_COLORS[color];
  return (
    <div className="flex items-center gap-3.5 px-4 py-4" data-testid={`reminder-${s.id}`}>
      <Avatar initials={s.initials} />
      <div className="flex-1">
        <p className="text-lg font-bold">{s.name}</p>
        <p className="text-sm text-muted-foreground">${s.amount} · {s.due_text}</p>
      </div>
      <button data-testid={`remind-btn-${s.id}`} onClick={() => onRemind(s.id)}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${c.btn}`}>
        <Bell className="h-4 w-4" /> Remind
      </button>
    </div>
  );
}

function ReminderSection({ label, color, items, onRemind, onRemindAll }) {
  const c = REMIND_COLORS[color];
  if (!items?.length) return null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em]">
          <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} /> <span className={c.label}>{label}</span>
        </p>
        <button data-testid={`remind-all-${color}`} onClick={onRemindAll}
          className={`rounded-full px-4 py-1.5 text-sm font-bold ${c.all}`}>Remind All</button>
      </div>
      <div className="divide-y divide-border/70 rounded-3xl bg-card shadow-jade">
        {items.map((s) => <ReminderRow key={s.id} s={s} color={color} onRemind={onRemind} />)}
      </div>
    </div>
  );
}

function RemindTab() {
  const [data, setData] = useState(null);
  const load = () => api.get("/creator/reminders").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const remind = async (id) => { const { data: r } = await api.post(`/creator/subscribers/${id}/remind`); toast.success(r.message); };
  const remindGroup = async (g, label) => { const { data: r } = await api.post(`/creator/remind-group/${g}`); toast.success(`Reminded ${r.reminded} ${label}.`); };

  if (!data) return <Loader />;
  return (
    <div className="space-y-7">
      <TitleBar title="Tribute Reminders" />
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#b01049] via-[#c11a54] to-[#e14b7a] p-6 text-white shadow-jade-lg" data-testid="remind-hero">
        <div className="absolute top-6 right-6 h-16 w-16 rounded-full bg-gradient-to-br from-[#ffd27a] to-[#ff7a3c] shadow-[0_0_30px_rgba(255,140,60,0.7)]" />
        <p className="text-sm font-semibold text-white/85">Due This Week</p>
        <p className="mt-1 font-display text-6xl font-bold">${data.due_this_week_total}</p>
        <p className="mt-3 text-white/80">Missed tribute reminders go out automatically</p>
        <Button data-testid="remind-all-week" onClick={() => remindGroup("week", "subscribers due this week")}
          className="mt-5 h-14 w-full rounded-full bg-white text-lg font-bold text-primary hover:bg-white/90">
          Remind All Due This Week
        </Button>
      </div>

      <ReminderSection label="Due in 1–3 days" color="amber" items={data.due_1_3}
        onRemind={remind} onRemindAll={() => remindGroup("due_1_3", "subscribers")} />
      <ReminderSection label="Due in 4–7 days" color="green" items={data.due_4_7}
        onRemind={remind} onRemindAll={() => remindGroup("due_4_7", "subscribers")} />
      <ReminderSection label="Overdue" color="pink" items={data.overdue}
        onRemind={remind} onRemindAll={() => remindGroup("overdue", "overdue subscribers")} />
    </div>
  );
}

/* ------------------------------- REQUESTS TAB ------------------------------ */
function RequestsTab({ go }) {
  const [reqs, setReqs] = useState(null);
  const load = () => api.get("/creator/requests").then((r) => setReqs(r.data.requests));
  useEffect(() => { load(); }, []);

  const act = async (id, action, name) => {
    const { data } = await api.post(`/creator/requests/${id}/${action}`);
    toast.success(`${action === "approve" ? "Approved" : "Declined"} ${name}.`);
    if (data.pending === 0) { go("home"); return; }
    load();
  };

  if (!reqs) return <Loader />;
  return (
    <div className="space-y-5">
      <div className="relative flex items-center justify-center pt-1">
        <button data-testid="requests-back" onClick={() => go("home")}
          className="absolute left-0 grid h-9 w-9 place-items-center rounded-full bg-card shadow-jade hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-bold">Requests</h1>
      </div>

      {reqs.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No pending requests.</p>
      ) : reqs.map((r) => (
        <div key={r.id} data-testid={`request-${r.id}`} className="rounded-3xl bg-card p-5 shadow-jade">
          <div className="flex items-center gap-3.5">
            <Avatar initials={r.initials} />
            <div>
              <p className="text-lg font-bold">{r.name}</p>
              <p className="text-sm text-muted-foreground">Requesting {r.plan_name}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button data-testid={`approve-${r.id}`} onClick={() => act(r.id, "approve", r.name)}
              className="h-12 rounded-full bg-emerald-500 font-bold hover:bg-emerald-600">Approve</Button>
            <Button data-testid={`decline-${r.id}`} onClick={() => act(r.id, "decline", r.name)} variant="ghost"
              className="h-12 rounded-full bg-primary/10 font-bold text-primary hover:bg-primary/20">Decline</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- INBOX (fan) ------------------------------ */
function InboxTab() {
  const [msgs, setMsgs] = useState(null);
  useEffect(() => { api.get("/creator/inbox").then((r) => setMsgs(r.data.messages)); }, []);
  if (!msgs) return <Loader />;
  return (
    <div className="space-y-4">
      <TitleBar title="Fan Inbox" />
      <div className="space-y-3" data-testid="fan-inbox">
        {msgs.map((m) => (
          <div key={m.id} className="flex items-start gap-3.5 rounded-3xl bg-card p-4 shadow-jade">
            <Avatar initials={m.initials} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-bold">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.when}</p>
              </div>
              <p className="mt-1 text-muted-foreground">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- chrome ---------------------------------- */
const Loader = () => (
  <div className="flex justify-center py-24"><div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
);

function TitleBar({ title }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="w-16" />
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <button data-testid="creator-logout" onClick={async () => { await logout(); navigate("/"); }}
        className="w-16 text-right text-sm font-semibold text-muted-foreground hover:text-primary">Exit</button>
    </div>
  );
}

const TABS = [
  { key: "home", label: "Home", Icon: BarChart3 },
  { key: "tribute", label: "Tribute", Icon: Heart },
  { key: "subs", label: "Subs", Icon: Users },
  { key: "remind", label: "Remind", Icon: Bell },
];

export default function CreatorApp() {
  const [tab, setTab] = useState("home");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen w-full max-w-md bg-background px-5 pb-32 pt-6">
        {tab === "home" && <HomeTab go={setTab} />}
        {tab === "tribute" && <TributeTab />}
        {tab === "subs" && <SubsTab />}
        {tab === "remind" && <RemindTab />}
        {tab === "inbox" && <InboxTab />}
        {tab === "requests" && <RequestsTab go={setTab} />}
      </div>

      <nav className="fixed bottom-4 left-1/2 z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-around rounded-full bg-white/90 p-2 shadow-jade-lg backdrop-blur-xl"
        data-testid="creator-nav">
        {TABS.map((t) => {
          const activeTab = tab === t.key || ((tab === "inbox" || tab === "requests") && t.key === "home");
          return (
            <button key={t.key} data-testid={`nav-${t.key}`} onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-full py-2.5 transition-colors ${
                activeTab ? "bg-primary/10 text-primary" : "text-foreground"
              }`}>
              <t.Icon className={`h-6 w-6 ${activeTab ? "" : ""}`} fill={activeTab && (t.key === "tribute" || t.key === "remind") ? "currentColor" : "none"} />
              <span className="text-xs font-semibold">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
