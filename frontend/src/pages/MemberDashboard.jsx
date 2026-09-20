import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Repeat, Plus, Crown, TrendingUp, Clock } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

export default function MemberDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/tributes/me").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  const active = data?.active_membership;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your standing</span>
            <h1 className="mt-2 font-display text-4xl font-bold">Hello, {user?.name?.split(" ")[0] || "Patron"}.</h1>
            <p className="mt-1 text-muted-foreground">Your place in the Jade Dynasty.</p>
          </div>
          <Button data-testid="dashboard-new-tribute" onClick={() => navigate("/join")}
            className="h-12 rounded-full px-6 shadow-jade transition-transform hover:-translate-y-0.5">
            <Plus className="mr-1 h-5 w-5" /> New tribute
          </Button>
        </div>

        {/* Bento stats */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2 rounded-3xl bg-gradient-to-br from-[#4A0E1B] via-[#c11a54] to-[#FF4E88] p-8 text-white shadow-jade-lg">
            <div className="flex items-center gap-2 text-white/80">
              <Crown className="h-5 w-5" /> <span className="text-sm font-medium uppercase tracking-wider">Membership</span>
            </div>
            {active ? (
              <>
                <div className="mt-5 flex items-end gap-2">
                  <span className="font-display text-5xl font-bold">${active.amount.toFixed(2)}</span>
                  <span className="mb-1.5 text-white/80 capitalize">/ {active.frequency}</span>
                </div>
                <p className="mt-3 inline-flex items-center gap-2 text-white/85">
                  <Repeat className="h-4 w-4" /> Active recurring tribute · since {fmtDate(active.created_at)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-5 text-lg text-white/85">You have no active recurring tribute yet.</p>
                <Button data-testid="dashboard-start-membership" onClick={() => navigate("/join")}
                  className="mt-5 h-11 rounded-full bg-white px-6 text-[#4A0E1B] hover:bg-white/90">
                  Start a recurring tribute
                </Button>
              </>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-3xl bg-card p-7 shadow-jade flex flex-col justify-between">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="h-5 w-5" /> <span className="text-sm font-medium uppercase tracking-wider">Total given</span>
            </div>
            <div>
              <span className="font-display text-5xl font-bold">${(data?.total_contributed || 0).toFixed(2)}</span>
              <p className="mt-2 text-muted-foreground">{data?.tributes?.length || 0} tributes in total</p>
            </div>
          </motion.div>
        </div>

        {/* History */}
        <div className="mt-8 rounded-3xl bg-card p-7 shadow-jade">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold">Tribute history</h2>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : data?.tributes?.length ? (
            <div className="mt-5 divide-y divide-border" data-testid="tribute-history">
              {data.tributes.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-4" data-testid={`tribute-row-${t.id}`}>
                  <div className="flex items-center gap-4">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ${t.type === "recurring" ? "bg-primary/10 text-primary" : "bg-accent text-foreground"}`}>
                      {t.type === "recurring" ? <Repeat className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
                    </span>
                    <div>
                      <p className="font-semibold capitalize">
                        {t.type === "recurring" ? `${t.frequency} tribute` : "One-time tribute"}
                      </p>
                      <p className="text-sm text-muted-foreground">{fmtDate(t.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${t.amount.toFixed(2)}</p>
                    <Badge variant="secondary" className={`rounded-full capitalize ${t.status === "active" || t.status === "completed" ? "bg-primary/10 text-primary" : ""}`}>
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No tributes yet — begin your journey.</p>
              <Button data-testid="dashboard-empty-cta" onClick={() => navigate("/join")}
                className="mt-5 h-11 rounded-full px-6 shadow-jade">Make your first tribute</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
