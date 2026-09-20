import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Crown, Repeat, ShieldCheck, Sparkles } from "lucide-react";
import { Navbar, JadeChip } from "@/components/Brand";
import { Button } from "@/components/ui/button";

const HERO_IMG =
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMHBpbmslMjBncmFkaWVudHxlbnwwfHx8fDE3ODk4ODg0NjR8MA&ixlib=rb-4.1.0&q=85";

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#3d0a17] via-[#c11a54] to-[#ff6fa3]">
          <img src={HERO_IMG} alt="" className="h-full w-full object-cover opacity-40 mix-blend-soft-light" />
          <div className="absolute inset-0 jade-grain opacity-20 mix-blend-overlay" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-[#ff6fa3]/40 blur-3xl animate-float-slow" />
        </div>

        <div className="relative z-10">
          <Navbar transparent />
          <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-16 pb-28 sm:pt-24 sm:pb-40">
            <motion.div initial="hidden" animate="show" className="max-w-3xl">
              <motion.div variants={fade} custom={0}>
                <JadeChip light />
              </motion.div>
              <motion.h1
                variants={fade}
                custom={1}
                className="mt-6 font-display text-5xl sm:text-7xl font-bold leading-[1.02] text-white"
              >
                Welcome to <span className="italic">Jade &amp; Co.</span>
              </motion.h1>
              <motion.p variants={fade} custom={2} className="mt-6 max-w-xl text-lg text-white/85">
                Join the Jade Dynasty. Choose your tribute — your amount, your rhythm, your way to pay.
              </motion.p>
              <motion.div variants={fade} custom={3} className="mt-10 flex flex-col sm:flex-row gap-4">
                <Button
                  data-testid="hero-join-btn"
                  onClick={() => navigate("/register")}
                  className="group h-14 rounded-full px-8 text-base shadow-jade-lg transition-transform hover:-translate-y-0.5"
                >
                  Join the Dynasty
                  <ArrowRight className="ml-1 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  data-testid="hero-signin-btn"
                  onClick={() => navigate("/login")}
                  variant="outline"
                  className="h-14 rounded-full border-white/40 bg-white/10 px-8 text-base text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
                >
                  I already have an account
                </Button>
              </motion.div>
              <motion.button
                variants={fade}
                custom={4}
                data-testid="hero-onetime-btn"
                onClick={() => navigate("/one-time")}
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
              >
                <Heart className="h-4 w-4" /> Send a one-time tribute
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* VALUE PROPS */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 -mt-16 relative z-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Repeat, title: "Your rhythm", body: "Give weekly, monthly, or yearly — pause or change your tribute whenever you wish." },
            { icon: Crown, title: "Dynasty status", body: "Members unlock a personal dashboard tracking every tribute and their standing." },
            { icon: ShieldCheck, title: "Paid your way", body: "Secure checkout powered by PayPal for both one-time and recurring tributes." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              variants={fade}
              custom={i}
              className="rounded-3xl bg-card p-8 shadow-jade"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fade}>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The Dynasty</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl font-semibold leading-tight">
              A gathering of patrons, bound by tribute.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Every tribute — grand or humble — sustains the house of Jade &amp; Co. Choose your amount, set your
              rhythm, and take your place among the Dynasty.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Button
                data-testid="community-join-btn"
                onClick={() => navigate("/register")}
                className="h-13 rounded-full px-7 shadow-jade transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="mr-1 h-4 w-4" /> Begin your tribute
              </Button>
            </div>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={fade}
            custom={1}
            className="relative"
          >
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary/15 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] shadow-jade-lg aspect-[4/3] bg-gradient-to-br from-[#3d0a17] via-[#c11a54] to-[#ff6fa3] p-10 flex flex-col justify-between">
              <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl animate-float-slow" />
              <Crown className="h-10 w-10 text-white/90" />
              <div>
                <p className="font-display text-3xl sm:text-4xl font-semibold leading-tight text-white">
                  Your amount. Your rhythm. Your way to pay.
                </p>
                <p className="mt-4 inline-flex items-center gap-2 text-white/80">
                  <Heart className="h-4 w-4 fill-current" /> The Jade Dynasty
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-white/50 py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <Heart className="h-4 w-4 fill-primary text-primary" /> Jade &amp; Co.
          </div>
          <p className="text-sm text-muted-foreground">Join the Jade Dynasty · Your amount, your rhythm, your way to pay.</p>
        </div>
      </footer>
    </div>
  );
}
