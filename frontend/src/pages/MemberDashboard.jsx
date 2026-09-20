import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Heart, Sparkles, Repeat, ArrowRight, Crown, MessageCircle } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getMethodInfo } from "@/lib/paymentMethods";
import { Button } from "@/components/ui/button";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

export default function MemberDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/membership/me").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const membership = data?.membership;
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md min-h-screen bg-background pb-16">
        {/* app bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button data-testid="member-back" onClick={() => navigate("/")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl font-bold">My Membership</h1>
          <div className="flex items-center gap-1">
            <button data-testid="member-messages-link" onClick={() => navigate("/messages")} className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-muted">
              <MessageCircle className="h-5 w-5" />
            </button>
            <button data-testid="member-profile-link" onClick={() => navigate("/profile")} className="grid h-9 w-9 place-items-center rounded-full text-primary hover:bg-muted">
              <Heart className="h-5 w-5 fill-current" />
            </button>
          </div>
        </div>

        <div className="px-5">
          {/* greeting */}
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h2 className="font-display text-4xl font-bold">Hi{firstName ? `, ${firstName}` : ""},</h2>
              <p className="mt-1 text-muted-foreground">Your Jade Dynasty membership</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-5 w-5 fill-current" />
            </span>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center"><div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
          ) : membership ? (
            /* ACTIVE membership card */
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#4A0E1B] via-[#c11a54] to-[#FF4E88] p-7 text-white shadow-jade-lg relative"
              data-testid="membership-card">
              <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-white/90">
                  <Sparkles className="h-4 w-4" /> {membership.tier} Tier
                </span>
                <span className="rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-semibold text-emerald-950">Active</span>
              </div>
              <div className="relative mt-5 flex items-end gap-2">
                <span className="font-display text-6xl font-bold">${membership.amount.toFixed(2)}</span>
                <span className="mb-2 text-white/80 capitalize">/ {membership.frequency}</span>
              </div>
              <p className="relative mt-3 inline-flex items-center gap-2 text-white/85">
                <Repeat className="h-4 w-4" /> Next tribute {fmtDate(membership.next_tribute_date)}
                {membership.method && <> · via {getMethodInfo(membership.method).label}</>}
              </p>
              <div className="relative mt-6 grid grid-cols-2 gap-3">
                <Button data-testid="send-tribute-btn" onClick={() => navigate("/profile")}
                  className="h-12 rounded-full bg-white text-[#4A0E1B] hover:bg-white/90">Send a tribute</Button>
                <Button data-testid="change-plan-btn" onClick={() => navigate("/plans")} variant="outline"
                  className="h-12 rounded-full border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white">Change plan</Button>
              </div>
            </motion.div>
          ) : (
            /* NO active membership */
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-3xl bg-primary/5 p-8 text-center" data-testid="no-membership">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white shadow-jade">
                <Heart className="h-7 w-7 fill-primary text-primary" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold">No active membership</h3>
              <p className="mt-2 text-muted-foreground">Start supporting your favorite creator with a plan that fits you.</p>
              <Button data-testid="choose-plan-btn" onClick={() => navigate("/plans")}
                className="mt-6 h-13 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5">
                <Crown className="mr-1.5 h-5 w-5" /> Choose a Plan
              </Button>
              <button data-testid="one-time-link" onClick={() => navigate("/profile")}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Or send a one-time tribute <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* payment history */}
          <h3 className="mt-9 font-display text-2xl font-bold">Payment History</h3>
          <div className="mt-4 space-y-3" data-testid="tribute-history">
            {loading ? null : data?.history?.length ? data.history.map((t) => {
              const info = t.method ? getMethodInfo(t.method) : null;
              return (
                <div key={t.id} data-testid={`tribute-row-${t.id}`} className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-jade">
                  <span className="grid h-11 w-11 place-items-center rounded-xl font-bold text-white" style={{ backgroundColor: info ? info.color : "#FF4E88" }}>
                    {info ? (info.symbol || info.label[0]) : <Heart className="h-5 w-5" />}
                  </span>
                  <div className="flex-1">
                    <p className="text-lg font-bold">${t.amount.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{(info ? info.label : "Tribute")} · {fmtDate(t.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${["confirmed", "completed", "active"].includes(t.status) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{t.status}</span>
                </div>
              );
            }) : (
              <div className="rounded-2xl bg-card p-8 text-center text-muted-foreground shadow-jade" data-testid="no-payments">No payments yet</div>
            )}
          </div>

          <button data-testid="member-signout" onClick={async () => { await logout(); navigate("/"); }}
            className="mt-8 w-full py-3 text-center text-sm font-semibold text-muted-foreground hover:text-primary">Sign out</button>
        </div>
      </div>
    </div>
  );
}
