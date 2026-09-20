import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart, Sparkles, Crown, ShieldCheck, ExternalLink, Copy, Check,
  ArrowUpRight, X, CalendarClock, Repeat, DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PAYMENT_METHODS, getMethod } from "@/lib/paymentMethods";
import { Navbar } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function MethodTile({ m, active, onClick }) {
  return (
    <button
      data-testid={`method-${m.key}`}
      onClick={onClick}
      className={`relative grid aspect-square place-items-center rounded-2xl border-2 transition-all hover:-translate-y-0.5 ${
        active ? "border-primary bg-white shadow-jade" : "border-transparent bg-muted"
      }`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl font-bold text-white text-lg" style={{ backgroundColor: m.color }}>
        {m.symbol}
      </span>
      {active && (
        <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [methodKey, setMethodKey] = useState("venmo");
  const [amount, setAmount] = useState(25);
  const [marking, setMarking] = useState(false);

  const load = () =>
    api.get("/membership/me").then((r) => {
      setData(r.data);
      if (r.data.membership) {
        setMethodKey(r.data.membership.method || "venmo");
        setAmount(r.data.membership.amount || 25);
      }
    }).finally(() => setLoading(false));

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const membership = data?.membership;
  const method = getMethod(methodKey);
  const payLink = method.supportsAmount ? method.link(Number(amount) || 0) : method.link();

  const openMethod = () => window.open(payLink, "_blank", "noopener,noreferrer");
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(payLink); toast.success("Payment link copied."); }
    catch { toast.error("Could not copy link."); }
  };
  const markPaid = async () => {
    setMarking(true);
    try {
      await api.post("/tributes/self-report", { amount: Number(amount), method: methodKey });
      toast.success("Tribute logged. Good girl. 🖤");
      await load();
    } catch { toast.error("Could not log tribute."); }
    finally { setMarking(false); }
  };
  const cancelMembership = async () => {
    await api.post("/membership/cancel");
    toast.message("Membership cancelled.");
    await load();
  };

  const statusStyle = (s) =>
    ["confirmed", "completed", "active"].includes(s)
      ? "bg-emerald-100 text-emerald-700"
      : s === "pending" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-2xl px-5 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Jade Dynasty</span>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl font-bold">My Membership</h1>
            <p className="mt-2 text-muted-foreground">Serve your Goddess — on your rhythm, your way.</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
            <Heart className="h-5 w-5 fill-current" />
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Membership card */}
            {membership ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="mt-7 overflow-hidden rounded-3xl bg-gradient-to-br from-[#4A0E1B] via-[#c11a54] to-[#FF4E88] p-7 text-white shadow-jade-lg relative"
                data-testid="membership-card">
                <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-white/90">
                    <Sparkles className="h-4 w-4" /> {membership.tier} Tier
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-semibold text-emerald-950">
                    <Check className="h-3.5 w-3.5" /> Active
                  </span>
                </div>
                <div className="relative mt-5 flex items-end gap-2">
                  <span className="font-display text-6xl font-bold">${membership.amount.toFixed(2)}</span>
                  <span className="mb-2 text-white/80 capitalize">/ {membership.frequency}</span>
                </div>
                <div className="relative mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Next tribute</p>
                    <p className="mt-1 font-semibold">{fmtDate(membership.next_tribute_date)}</p>
                    <p className="text-sm text-white/70">{membership.days_until <= 0 ? "due now" : `in ${membership.days_until} days`}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Method</p>
                    <p className="mt-1 inline-flex items-center gap-2 font-semibold">
                      <span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ backgroundColor: getMethod(membership.method).color }}>
                        {getMethod(membership.method).symbol}
                      </span>
                      {getMethod(membership.method).label}
                    </p>
                  </div>
                </div>
                <div className="relative mt-6 grid grid-cols-2 gap-3">
                  <Button data-testid="upgrade-tier-btn" onClick={() => navigate("/join")}
                    className="h-12 rounded-full bg-white text-[#4A0E1B] hover:bg-white/90">
                    <ArrowUpRight className="mr-1 h-4 w-4" /> Upgrade tier
                  </Button>
                  <Button data-testid="cancel-membership-btn" onClick={cancelMembership} variant="outline"
                    className="h-12 rounded-full border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white">
                    <X className="mr-1 h-4 w-4" /> Cancel
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="mt-7 rounded-3xl bg-card p-7 shadow-jade text-center" data-testid="no-membership">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Crown className="h-7 w-7" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-semibold">Pledge your devotion</h2>
                <p className="mt-2 text-muted-foreground">You have no active tribute yet. Choose your tier and rhythm to serve your Goddess.</p>
                <Button data-testid="start-membership-btn" onClick={() => navigate("/join")}
                  className="mt-5 h-12 rounded-full px-7 shadow-jade">Begin my devotion</Button>
              </div>
            )}

            {/* Send this month's tribute */}
            <h2 className="mt-10 font-display text-2xl font-semibold flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary fill-primary" /> Send your tribute
            </h2>
            <div className="mt-4 rounded-3xl bg-card p-6 sm:p-7 shadow-jade" data-testid="send-tribute-card">
              {/* Amount */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground mr-1">Amount</span>
                {[10, 25, 50, 100].map((a) => (
                  <button key={a} data-testid={`send-amount-${a}`} onClick={() => setAmount(a)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                      Number(amount) === a ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"
                    }`}>${a}</button>
                ))}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input data-testid="send-amount-custom" type="number" min="1" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-9 w-24 rounded-full bg-white pl-6 text-sm" />
                </div>
              </div>

              {/* Step 1: choose method */}
              <div className="mt-6">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
                  Choose how you'll send it
                </p>
                <div className="mt-3 grid grid-cols-5 gap-2.5" data-testid="method-grid">
                  {PAYMENT_METHODS.map((m) => (
                    <MethodTile key={m.key} m={m} active={methodKey === m.key} onClick={() => setMethodKey(m.key)} />
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Sending to <span className="font-semibold text-foreground">{method.handle}</span> on {method.label}
                </p>
              </div>

              {/* Step 2: open + send */}
              <div className="mt-6 border-t border-border pt-6">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
                  Open {method.label} and send ${Number(amount || 0).toFixed(2)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {method.supportsAmount
                    ? `We'll open ${method.label} with the amount pre-filled. Complete the payment to your Goddess.`
                    : `We'll open ${method.label}. Send your tribute to your Goddess there.`}
                </p>
                <div className="mt-4 grid gap-2.5">
                  <Button data-testid="open-method-btn" onClick={openMethod}
                    className="h-12 rounded-full text-white shadow-jade transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: method.color }}>
                    Open {method.label} <ExternalLink className="ml-1.5 h-4 w-4" />
                  </Button>
                  <Button data-testid="copy-link-btn" onClick={copyLink} variant="outline" className="h-11 rounded-full bg-white">
                    <Copy className="mr-1.5 h-4 w-4" /> Copy payment link
                  </Button>
                </div>
              </div>

              {/* Step 3: confirm */}
              <div className="mt-6 border-t border-border pt-6">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
                  Confirm your tribute
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  After you send ${Number(amount || 0).toFixed(2)}, tap below — we'll log it to your devotion history.
                </p>
                <Button data-testid="mark-paid-btn" onClick={markPaid} disabled={marking || !amount}
                  className="mt-4 h-13 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5">
                  <Check className="mr-1.5 h-5 w-5" /> {marking ? "Logging…" : "I've sent it — mark paid"}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Self-reported. We never touch your money.
                </p>
              </div>
            </div>

            {/* Payment history */}
            <h2 className="mt-10 font-display text-2xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Payment history
            </h2>
            <div className="mt-4 grid gap-3" data-testid="tribute-history">
              {data?.history?.length ? data.history.map((t) => {
                const m = t.method ? getMethod(t.method) : null;
                return (
                  <div key={t.id} data-testid={`tribute-row-${t.id}`}
                    className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-jade">
                    <span className="grid h-12 w-12 place-items-center rounded-xl font-bold text-white text-lg"
                      style={{ backgroundColor: m ? m.color : "#FF4E88" }}>
                      {m ? m.symbol : (t.type === "recurring" ? <Repeat className="h-5 w-5" /> : <Heart className="h-5 w-5" />)}
                    </span>
                    <div className="flex-1">
                      <p className="text-lg font-bold">${t.amount.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {(m ? m.label : (t.type === "recurring" ? `${t.frequency} tribute` : "Tribute"))} · {fmtDate(t.created_at)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusStyle(t.status)}`}>
                      {t.status}
                    </span>
                  </div>
                );
              }) : (
                <div className="rounded-2xl bg-card p-8 text-center text-muted-foreground shadow-jade">
                  No tributes yet — send your first above.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
