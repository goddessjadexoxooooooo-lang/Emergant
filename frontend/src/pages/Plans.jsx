import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Check, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

function PlanCard({ plan, index, onSubscribe }) {
  const featured = plan.featured;
  const cadenceLabel = plan.cadence === "one-time" ? "once" : plan.cadence;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      data-testid={`plan-card-${plan.id}`}
      className={`rounded-[1.75rem] p-6 shadow-jade ${featured ? "bg-gradient-to-br from-[#c11a54] to-[#FF4E88] text-white" : "bg-card"}`}
    >
      <div className="flex items-start justify-between">
        <h3 className={`font-display text-2xl font-bold ${featured ? "text-white" : "text-foreground"}`}>{plan.name}</h3>
        <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${featured ? "bg-white/25 text-white" : "bg-primary text-primary-foreground"}`}>
          {plan.badge}
        </span>
      </div>

      <p className={`mt-3 font-display text-4xl font-bold ${featured ? "text-white" : "text-primary"}`}>
        ${plan.price}
        <span className={`ml-1 align-baseline text-base font-medium ${featured ? "text-white/80" : "text-primary/80"}`}>
          {plan.cadence === "one-time" ? "once" : `/ ${cadenceLabel}`}
        </span>
      </p>

      <p className={`mt-3 ${featured ? "text-white/85" : "text-muted-foreground"}`}>{plan.desc}</p>

      <ul className="mt-4 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-3">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${featured ? "bg-white/25 text-white" : "bg-foreground text-background"}`}>
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className={featured ? "text-white" : "text-foreground"}>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        data-testid={`subscribe-${plan.id}`}
        onClick={() => onSubscribe(plan)}
        className={`mt-6 h-14 w-full rounded-2xl text-base font-bold shadow-jade transition-transform hover:-translate-y-0.5 ${
          featured ? "bg-white text-primary hover:bg-white/90" : ""
        }`}
      >
        {plan.cadence === "one-time" ? "Get Access" : "Subscribe"} <ArrowRight className="ml-1.5 h-5 w-5" />
      </Button>
    </motion.div>
  );
}

export default function Plans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);

  useEffect(() => { api.get("/plans").then((r) => setPlans(r.data.plans)); }, []);

  const subscribe = (plan) => {
    const q = `?amount=${plan.price}&frequency=${plan.cadence}`;
    navigate(user ? `/join${q}` : `/login`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md min-h-screen bg-background pb-16">
        {/* pink welcome header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#e14b7a] via-[#c11a54] to-[#a3113f] px-6 pt-10 pb-8 text-white">
          <div className="absolute inset-0 jade-grain opacity-15 mix-blend-overlay" />
          <button data-testid="plans-back" onClick={() => navigate(user ? "/dashboard" : "/")}
            className="relative mb-4 text-sm font-semibold text-white/80 hover:text-white">← Back</button>
          <h1 className="relative font-display text-4xl font-bold leading-tight">Welcome to Jade &amp; Co.</h1>
          <span className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-md">
            Your journey starts here. <Heart className="h-4 w-4 fill-current" />
          </span>
        </div>

        <div className="px-5 pt-6">
          <h2 className="font-display text-3xl font-bold text-primary">Choose Your Membership</h2>
          <div className="mt-5 space-y-6" data-testid="plans-list">
            {plans
              ? plans.map((p, i) => <PlanCard key={p.id} plan={p} index={i} onSubscribe={subscribe} />)
              : <div className="flex justify-center py-16"><div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            All memberships renew automatically. Cancel or pause any time from My Subscription.
          </p>
        </div>
      </div>
    </div>
  );
}
