import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Check, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  CHECKOUT_METHODS, getMethodInfo, AMOUNT_PRESETS, TIER_MIN, TIER_MAX, tierForAmount,
} from "@/lib/paymentMethods";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const FREQS = [
  { key: "weekly", label: "Weekly" },
  { key: "bi-weekly", label: "Bi-weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "one-time", label: "One-time" },
];

export default function TributeFlow({ oneTime = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const presetAmount = parseFloat(params.get("amount"));
  const presetFreq = params.get("frequency");
  const [amount, setAmount] = useState(Number.isFinite(presetAmount) ? presetAmount : 50);
  const [frequency, setFrequency] = useState(oneTime ? "one-time" : (presetFreq || "monthly"));
  const [methodKey, setMethodKey] = useState("paypal");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const tier = tierForAmount(amount);
  const pct = Math.min(100, Math.max(0, ((amount - TIER_MIN) / (TIER_MAX - TIER_MIN)) * 100));
  const freqLabel = frequency === "one-time" ? "one-time" : frequency;
  const method = getMethodInfo(methodKey);

  const pay = async () => {
    if (!user && frequency !== "one-time") { navigate("/login"); return; }
    setBusy(true);
    try {
      if (method.link) window.open(method.link(amount), "_blank", "noopener,noreferrer");
      if (frequency === "one-time") {
        if (user) await api.post("/tributes/self-report", { amount, method: methodKey });
        setDone({ amount, frequency });
      } else {
        await api.post("/membership/setup", { amount, frequency, method: methodKey });
        setDone({ amount, frequency });
      }
    } catch { toast.error("Something went wrong. Please try again."); setBusy(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-jade-lg">
            <Check className="h-10 w-10" />
          </motion.div>
          <h1 className="mt-8 font-display text-4xl font-bold">Almost there</h1>
          <p className="mt-3 text-lg text-muted-foreground">Please finish your ${done.amount.toFixed(2)} payment in the PayPal tab that just opened. Your Goddess will confirm it, and your membership starts the moment she does.</p>
          <Button data-testid="checkout-done-btn" onClick={() => navigate(user ? "/dashboard" : "/")}
            className="mt-10 h-12 rounded-full px-7 shadow-jade">{user ? "View my membership" : "Back home"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md min-h-screen bg-background pb-28">
        {/* app bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button data-testid="checkout-back" onClick={() => navigate(user ? "/dashboard" : "/")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl font-bold">Checkout</h1>
          <span className="w-9" />
        </div>

        <div className="px-5">
          {/* amount */}
          <p className="mt-2 text-sm font-semibold text-muted-foreground">Your Amount</p>
          <p className="mt-1 font-display text-6xl font-bold" data-testid="checkout-amount">
            <span className="text-primary">$</span>{amount.toLocaleString()}
          </p>

          <div className="mt-5 grid grid-cols-4 gap-2.5" data-testid="amount-grid">
            {AMOUNT_PRESETS.map((a) => {
              const active = amount === a;
              return (
                <button key={a} data-testid={`amount-${a}`} onClick={() => setAmount(a)}
                  className={`rounded-2xl border-2 py-3 text-sm font-bold transition-all hover:-translate-y-0.5 ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"
                  }`}>${a >= 1000 ? "1,000" : a}</button>
              );
            })}
          </div>

          {/* tier bar */}
          <div className="mt-5">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary" data-testid="tier-pill">
                <Sparkles className="h-4 w-4" /> {tier} tier
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-gradient-to-r from-[#c11a54] to-[#FF4E88] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>${TIER_MIN}</span><span>${TIER_MAX.toLocaleString()}</span>
            </div>
          </div>

          {/* frequency */}
          {!oneTime && (
            <>
              <p className="mt-7 text-sm font-semibold">Billing Frequency</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5" data-testid="frequency-grid">
                {FREQS.map((f) => {
                  const active = frequency === f.key;
                  return (
                    <button key={f.key} data-testid={`frequency-${f.key}`} onClick={() => setFrequency(f.key)}
                      className={`rounded-2xl border-2 py-3.5 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"
                      }`}>{f.label}</button>
                  );
                })}
              </div>
            </>
          )}

          {/* payment methods */}
          <p className="mt-7 text-sm font-semibold">Payment Method</p>
          <div className="mt-3 space-y-2.5" data-testid="method-list">
            {CHECKOUT_METHODS.map((m) => {
              const info = getMethodInfo(m.key);
              const active = methodKey === m.key;
              return (
                <button key={m.key} data-testid={`method-${m.key}`} onClick={() => setMethodKey(m.key)}
                  className={`flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left transition-all hover:-translate-y-0.5 ${
                    active ? "border-primary bg-primary/5 shadow-jade" : "border-border bg-card"
                  }`}>
                  <span className="grid h-11 w-11 place-items-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: info.color }}>
                    {info.symbol || info.label[0]}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{info.label}</span>
                    <span className="block text-sm text-muted-foreground">{m.sub}</span>
                  </span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* sticky footer */}
        <div className="fixed bottom-0 left-1/2 z-30 w-[min(28rem,100%)] -translate-x-1/2 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">You'll pay</p>
              <p className="font-display text-lg font-bold">
                ${amount.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ {freqLabel}</span>
              </p>
            </div>
            <Button data-testid="pay-join-btn" onClick={pay} disabled={busy}
              className="h-13 rounded-full px-7 text-base shadow-jade transition-transform hover:-translate-y-0.5">
              {busy ? "Please wait…" : frequency === "one-time" ? "Send Tribute" : "Pay & Join"} <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
