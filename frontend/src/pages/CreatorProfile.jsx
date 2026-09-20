import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Heart, ArrowRight, ExternalLink, Copy } from "lucide-react";
import { QUICK_LINKS, getMethodInfo } from "@/lib/paymentMethods";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

export default function CreatorProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const open = (info) => {
    if (info.link) window.open(info.link(""), "_blank", "noopener,noreferrer");
    else {
      navigator.clipboard?.writeText(info.handle).catch(() => {});
      toast.success(`${info.label} copied: ${info.handle}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md min-h-screen bg-background pb-16">
        {/* app bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-background/90 px-5 py-4 backdrop-blur-xl">
          <button data-testid="profile-back" onClick={() => navigate(user ? "/dashboard" : "/")}
            className="grid h-9 w-9 place-items-center rounded-full bg-card shadow-jade hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl font-bold">Jade</h1>
          <span className="grid h-9 w-9 place-items-center rounded-full text-primary"><Heart className="h-5 w-5 fill-current" /></span>
        </div>

        <div className="px-5">
          {/* tribute hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#b01049] via-[#c11a54] to-[#e14b7a] p-6 text-white shadow-jade-lg"
            data-testid="tribute-hero">
            <div className="absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur-md">
              <Heart className="h-5 w-5 fill-current" />
            </span>
            <h2 className="relative mt-4 font-display text-3xl font-bold">Send Jade a tribute</h2>
            <p className="relative mt-2 text-white/85">
              Your support means everything. Tap a link below to send a tribute, or start a membership for exclusive access.
            </p>
            <Button data-testid="start-membership-btn" onClick={() => navigate(user ? "/join" : "/register")}
              className="relative mt-5 h-12 w-full rounded-full bg-white text-base font-bold text-primary hover:bg-white/90">
              Start a Membership <ArrowRight className="ml-1 h-5 w-5" />
            </Button>
          </motion.div>

          {/* quick links */}
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-primary">Quick links</p>
          <div className="mt-3 space-y-3" data-testid="quick-links">
            {QUICK_LINKS.map((key) => {
              const info = getMethodInfo(key);
              return (
                <div key={key} data-testid={`quicklink-${key}`} className="flex items-center gap-3.5 rounded-3xl bg-card p-4 shadow-jade">
                  <span className="grid h-11 w-11 place-items-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: info.color }}>
                    {info.symbol || info.label[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{info.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{info.handle}</p>
                  </div>
                  <button data-testid={`open-${key}`} onClick={() => open(info)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20">
                    {info.link ? <ExternalLink className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Open
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
