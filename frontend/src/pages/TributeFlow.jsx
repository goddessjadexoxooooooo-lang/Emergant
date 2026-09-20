import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, Heart, Repeat, CalendarDays, CalendarClock,
  CalendarRange, ExternalLink, ShieldCheck, Crown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { PAYMENT_METHODS, getMethod } from "@/lib/paymentMethods";
import { Navbar } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

const AMOUNTS = [5, 10, 25, 50, 100];
const RHYTHMS = [
  { key: "one-time", label: "One-time", desc: "A single tribute", icon: Heart },
  { key: "weekly", label: "Weekly", desc: "Every week", icon: CalendarDays },
  { key: "monthly", label: "Monthly", desc: "Every month", icon: CalendarClock },
  { key: "yearly", label: "Yearly", desc: "Every year", icon: CalendarRange },
];

const slide = { enter: { opacity: 0, y: 20 }, center: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } };

export default function TributeFlow({ oneTime = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState("");
  const [rhythm, setRhythm] = useState(oneTime ? "one-time" : null);
  const [methodKey, setMethodKey] = useState("venmo");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const effectiveAmount = custom ? parseFloat(custom) : amount;
  const validAmount = effectiveAmount && effectiveAmount >= 1;
  const method = getMethod(methodKey);
  const payLink = method.supportsAmount ? method.link(Number(effectiveAmount) || 0) : method.link();

  const goNext = () => { if (step === 0 && oneTime) { setStep(2); return; } setStep((s) => s + 1); };
  const goBack = () => {
    if (step === 2 && oneTime) { setStep(0); return; }
    if (step === 0) { navigate(user ? "/dashboard" : "/"); return; }
    setStep((s) => s - 1);
  };

  const beginDevotion = async () => {
    setBusy(true);
    try {
      await api.post("/membership/setup", {
        amount: Number(effectiveAmount), frequency: rhythm, method: methodKey,
      });
      toast.success("Your devotion has begun. 🖤");
      navigate("/dashboard");
    } catch { toast.error("Could not start membership."); setBusy(false); }
  };

  const markOneTime = async () => {
    setBusy(true);
    try {
      if (user) await api.post("/tributes/self-report", { amount: Number(effectiveAmount), method: methodKey });
      setDone({ amount: Number(effectiveAmount) });
    } catch { toast.error("Could not log tribute."); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-2xl px-5 py-20 text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-jade-lg">
            <Check className="h-10 w-10" />
          </motion.div>
          <h1 className="mt-8 font-display text-4xl font-bold">Tribute received</h1>
          <p className="mt-3 text-lg text-muted-foreground">Thank you for your one-time tribute of ${done.amount.toFixed(2)} to your Goddess.</p>
          <Button data-testid="tribute-done-btn" onClick={() => navigate(user ? "/dashboard" : "/")}
            className="mt-10 h-12 rounded-full px-7 shadow-jade">{user ? "View my dashboard" : "Back home"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <div className="mb-8 flex items-center gap-2">
          {(oneTime ? [0, 2] : [0, 1, 2]).map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        <button data-testid="tribute-back-btn" onClick={goBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="rounded-3xl bg-card p-6 sm:p-10 shadow-jade">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="amount" variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your tribute</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">Choose your tribute</h2>
                <p className="mt-2 text-muted-foreground">How much will you offer your Goddess?</p>
                <div className="mt-7 grid grid-cols-3 gap-3" data-testid="amount-grid">
                  {AMOUNTS.map((a) => {
                    const active = !custom && amount === a;
                    return (
                      <button key={a} data-testid={`amount-${a}`} onClick={() => { setAmount(a); setCustom(""); }}
                        className={`rounded-2xl border-2 py-5 text-xl font-semibold transition-all hover:-translate-y-0.5 ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-foreground"
                        }`}>${a}</button>
                    );
                  })}
                  <div className="col-span-3 mt-2">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                      <Input id="custom" data-testid="amount-custom" type="number" min="1" step="1"
                        value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom amount"
                        className="h-12 rounded-2xl bg-white pl-8 text-lg" />
                    </div>
                  </div>
                </div>
                <Button data-testid="amount-continue-btn" disabled={!validAmount} onClick={goNext}
                  className="mt-8 h-12 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5">
                  Continue <ArrowRight className="ml-1 h-5 w-5" />
                </Button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="rhythm" variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your rhythm</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">How often will you serve?</h2>
                <p className="mt-2 text-muted-foreground">Give once, or pledge a recurring tribute.</p>
                <div className="mt-7 grid gap-3" data-testid="rhythm-grid">
                  {RHYTHMS.map((r) => {
                    const active = rhythm === r.key;
                    return (
                      <button key={r.key} data-testid={`rhythm-${r.key}`} onClick={() => setRhythm(r.key)}
                        className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${
                          active ? "border-primary bg-primary/10" : "border-border bg-white"
                        }`}>
                        <span className={`grid h-11 w-11 place-items-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                          <r.icon className="h-5 w-5" />
                        </span>
                        <span className="flex-1">
                          <span className="block font-semibold">{r.label}</span>
                          <span className="block text-sm text-muted-foreground">{r.desc}</span>
                        </span>
                        {active && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
                <Button data-testid="rhythm-continue-btn" disabled={!rhythm} onClick={goNext}
                  className="mt-8 h-12 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5">
                  Continue <ArrowRight className="ml-1 h-5 w-5" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="pay" variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your way to serve</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">
                  {rhythm === "one-time" ? "Send your tribute" : "Pledge your devotion"}
                </h2>

                <div className="mt-6 rounded-2xl bg-accent p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="text-2xl font-bold">${effectiveAmount.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Rhythm</span>
                    <span className="inline-flex items-center gap-1.5 font-medium capitalize">
                      {rhythm !== "one-time" && <Repeat className="h-4 w-4 text-primary" />}
                      {rhythm?.replace("-", " ")}
                    </span>
                  </div>
                </div>

                <p className="mt-6 font-semibold">Choose how you'll send it</p>
                <div className="mt-3 grid grid-cols-5 gap-2.5" data-testid="method-grid">
                  {PAYMENT_METHODS.map((m) => {
                    const active = methodKey === m.key;
                    return (
                      <button key={m.key} data-testid={`method-${m.key}`} onClick={() => setMethodKey(m.key)}
                        className={`relative grid aspect-square place-items-center rounded-2xl border-2 transition-all hover:-translate-y-0.5 ${
                          active ? "border-primary bg-white shadow-jade" : "border-transparent bg-muted"
                        }`}>
                        <span className="grid h-11 w-11 place-items-center rounded-xl font-bold text-white text-lg" style={{ backgroundColor: m.color }}>{m.symbol}</span>
                        {active && <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Sending to <span className="font-semibold text-foreground">{method.handle}</span> on {method.label}
                </p>

                {rhythm === "one-time" ? (
                  <div className="mt-6 grid gap-2.5">
                    <Button data-testid="open-method-btn" onClick={() => window.open(payLink, "_blank", "noopener,noreferrer")}
                      className="h-12 rounded-full text-white shadow-jade" style={{ backgroundColor: method.color }}>
                      Open {method.label} <ExternalLink className="ml-1.5 h-4 w-4" />
                    </Button>
                    <Button data-testid="mark-onetime-btn" onClick={markOneTime} disabled={busy}
                      className="h-13 rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5">
                      <Check className="mr-1.5 h-5 w-5" /> {busy ? "Logging…" : "I've sent it — mark paid"}
                    </Button>
                  </div>
                ) : (
                  <Button data-testid="begin-devotion-btn" onClick={beginDevotion} disabled={busy}
                    className="mt-6 h-13 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5">
                    <Crown className="mr-1.5 h-5 w-5" /> {busy ? "Please wait…" : "Begin my devotion"}
                  </Button>
                )}
                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Self-reported. We never touch your money.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
