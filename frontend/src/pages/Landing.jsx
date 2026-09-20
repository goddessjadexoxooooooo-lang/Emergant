import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const fade = {
  hidden: { opacity: 0, y: 22 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Pink -> plum gradient background matching the mobile welcome screen */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#ffb3cc] via-[#e8497e] to-[#33091a]">
        <div className="absolute inset-0 jade-grain opacity-20 mix-blend-overlay" />
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-white/25 blur-3xl animate-float-slow" />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-1 flex-col px-7 pt-10 pb-12 sm:px-10 sm:pt-14 sm:pb-16 max-w-md mx-auto w-full"
      >
        {/* Brand chip */}
        <motion.div variants={fade} custom={0}>
          <span
            data-testid="jade-chip"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground shadow-jade"
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            Jade Dynasty
          </span>
        </motion.div>

        {/* Headline block sits in the lower half like the mobile app */}
        <div className="flex-1" />

        <motion.h1
          variants={fade}
          custom={1}
          className="font-display text-6xl sm:text-7xl font-bold leading-[0.98] text-white"
        >
          Welcome to<br />Jade &amp; Co.
        </motion.h1>

        <motion.p variants={fade} custom={2} className="mt-5 text-lg text-white/85 leading-relaxed">
          Join the Jade Dynasty. Choose your tribute — your amount, your rhythm, your way to pay.
        </motion.p>

        <motion.div variants={fade} custom={3} className="mt-10">
          <Button
            data-testid="hero-join-btn"
            onClick={() => navigate("/register")}
            className="group h-16 w-full rounded-full text-lg font-semibold shadow-jade-lg transition-transform hover:-translate-y-0.5"
          >
            Join the Dynasty
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        <motion.button
          variants={fade}
          custom={4}
          data-testid="hero-signin-btn"
          onClick={() => navigate("/login")}
          className="mt-7 text-center text-base font-semibold text-white/90 transition-colors hover:text-white"
        >
          I already have an account
        </motion.button>

        <motion.button
          variants={fade}
          custom={5}
          data-testid="hero-onetime-btn"
          onClick={() => navigate("/one-time")}
          className="mt-6 inline-flex items-center justify-center gap-2 text-base font-semibold text-white/85 transition-colors hover:text-white"
        >
          <Heart className="h-4.5 w-4.5" /> Send a one-time tribute
        </motion.button>
      </motion.div>
    </div>
  );
}
