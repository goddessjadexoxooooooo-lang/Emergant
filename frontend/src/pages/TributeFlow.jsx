import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Heart, Repeat, CalendarDays, CalendarClock, CalendarRange } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PayPalCheckout from "@/components/PayPalCheckout";

const AMOUNTS = [5, 10, 25, 50, 100];
const RHYTHMS = [
  { key: "one-time", label: "One-time", desc: "A single tribute", icon: Heart },
  { key: "weekly", label: "Weekly", desc: "Every week", icon: CalendarDays },
  { key: "monthly", label: "Monthly", desc: "Every month", icon: CalendarClock },
  { key: "yearly", label: "Yearly", desc: "Every year", icon: CalendarRange },
];

const slide = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function TributeFlow({ oneTime = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState("");
  const [rhythm, setRhythm] = useState(oneTime ? "one-time" : null);
  const [guest, setGuest] = useState({ name: "", email: "" });
  const [done, setDone] = useState(null);

  const effectiveAmount = custom ? parseFloat(custom) : amount;
  const validAmount = effectiveAmount && effectiveAmount >= 1;
  const isGuest = !user;

  // steps: amount(0) -> rhythm(1, skipped if oneTime) -> pay(2)
  const goNext = () => {
    if (step === 0 && oneTime) { setStep(2); return; }
    setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step === 2 && oneTime) { setStep(0); return; }
    if (step === 0) { navigate(user ? "/dashboard" : "/"); return; }
    setStep((s) => s - 1);
  };

  const payMode = rhythm === "one-time" ? "order" : "subscription";

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-2xl px-5 py-20 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-jade-lg"
          >
            <Check className="h-10 w-10" />
          </motion.div>
          <h1 className="mt-8 font-display text-4xl font-bold">Tribute received</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {done.type === "recurring"
              ? `Your ${done.frequency} tribute of $${done.amount.toFixed(2)} is now active. Welcome to the Dynasty.`
              : `Thank you for your one-time tribute of $${done.amount.toFixed(2)}.`}
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button data-testid="tribute-view-dashboard" onClick={() => navigate(user ? "/dashboard" : "/")}
              className="h-12 rounded-full px-7 shadow-jade">
              {user ? "View my dashboard" : "Back home"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        {/* progress */}
        <div className="mb-8 flex items-center gap-2">
          {(oneTime ? [0, 2] : [0, 1, 2]).map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-border"}`}
            />
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
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your amount</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">Choose your tribute</h2>
                <p className="mt-2 text-muted-foreground">How much would you like to offer?</p>

                <div className="mt-7 grid grid-cols-3 gap-3" data-testid="amount-grid">
                  {AMOUNTS.map((a) => {
                    const active = !custom && amount === a;
                    return (
                      <button
                        key={a}
                        data-testid={`amount-${a}`}
                        onClick={() => { setAmount(a); setCustom(""); }}
                        className={`rounded-2xl border-2 py-5 text-xl font-semibold transition-all hover:-translate-y-0.5 ${
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-foreground"
                        }`}
                      >
                        ${a}
                      </button>
                    );
                  })}
                  <div className="col-span-3 mt-2">
                    <Label htmlFor="custom" className="text-muted-foreground">Or enter a custom amount</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                      <Input
                        id="custom" data-testid="amount-custom" type="number" min="1" step="1"
                        value={custom} onChange={(e) => setCustom(e.target.value)}
                        placeholder="Custom amount"
                        className="h-12 rounded-2xl bg-white pl-8 text-lg"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  data-testid="amount-continue-btn" disabled={!validAmount} onClick={goNext}
                  className="mt-8 h-12 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5"
                >
                  Continue <ArrowRight className="ml-1 h-5 w-5" />
                </Button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="rhythm" variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your rhythm</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">How often?</h2>
                <p className="mt-2 text-muted-foreground">Give once, or set a recurring tribute.</p>

                <div className="mt-7 grid gap-3" data-testid="rhythm-grid">
                  {RHYTHMS.map((r) => {
                    const active = rhythm === r.key;
                    return (
                      <button
                        key={r.key}
                        data-testid={`rhythm-${r.key}`}
                        onClick={() => setRhythm(r.key)}
                        className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${
                          active ? "border-primary bg-primary/10" : "border-border bg-white"
                        }`}
                      >
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

                <Button
                  data-testid="rhythm-continue-btn" disabled={!rhythm} onClick={goNext}
                  className="mt-8 h-12 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5"
                >
                  Continue <ArrowRight className="ml-1 h-5 w-5" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="pay" variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your way to pay</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">Complete your tribute</h2>

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

                {isGuest && rhythm === "one-time" && (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="gname">Name</Label>
                      <Input id="gname" data-testid="guest-name" value={guest.name}
                        onChange={(e) => setGuest({ ...guest, name: e.target.value })}
                        placeholder="Your name" className="h-12 rounded-2xl bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gemail">Email</Label>
                      <Input id="gemail" type="email" data-testid="guest-email" value={guest.email}
                        onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                        placeholder="you@email.com" className="h-12 rounded-2xl bg-white" />
                    </div>
                  </div>
                )}

                <div className="mt-7">
                  <PayPalCheckout
                    mode={payMode}
                    amount={Number(effectiveAmount.toFixed(2))}
                    frequency={rhythm === "one-time" ? null : rhythm}
                    guest={isGuest ? guest : null}
                    onSuccess={setDone}
                  />
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Secure checkout via PayPal · Sandbox test mode
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
