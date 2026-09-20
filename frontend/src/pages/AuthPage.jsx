import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function startGoogleLogin() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const { user, login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";
  const isAdmin = mode === "admin";

  useEffect(() => {
    if (user) navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = isRegister ? await register(name, email, password) : await login(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (isAdmin && res.user.role !== "admin") {
      setError("This account does not have admin access.");
      return;
    }
    toast.success(isRegister ? "Welcome to the Dynasty." : "Welcome back.");
    navigate(res.user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <button
          data-testid="auth-back-btn"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="flex-1 flex items-start justify-center px-5 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-3xl bg-card p-8 sm:p-10 shadow-jade"
        >
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${isAdmin ? "bg-[#4A0E1B] text-white" : "bg-primary/10 text-primary"}`}>
            {isAdmin ? <Crown className="h-6 w-6" /> : <Heart className="h-6 w-6 fill-current" />}
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold">
            {isAdmin ? "Admin sign in" : isRegister ? "Create account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {isAdmin ? "Enter the royal court." : isRegister ? "Start your Jade Dynasty journey" : "Continue your tribute."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" data-testid="auth-form">
            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name" data-testid="auth-name-input" value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required
                  className="h-12 rounded-2xl bg-white"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" data-testid="auth-email-input" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required
                className="h-12 rounded-2xl bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password" type="password" data-testid="auth-password-input" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? "At least 6 characters" : "Your password"} required
                className="h-12 rounded-2xl bg-white"
              />
            </div>

            {error && (
              <p data-testid="auth-error" className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit" data-testid="auth-submit-btn" disabled={busy}
              className="h-12 w-full rounded-full text-base shadow-jade transition-transform hover:-translate-y-0.5"
            >
              {busy ? "Please wait…" : isAdmin ? "Enter court" : isRegister ? "Create Account" : "Sign in"}
            </Button>
          </form>

          {!isAdmin && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button" variant="outline" data-testid="google-login-btn"
                onClick={startGoogleLogin}
                className="h-12 w-full rounded-full bg-white gap-2"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-5 w-5" />
                Continue with Google
              </Button>
            </>
          )}

          <div className="mt-7 text-center text-sm">
            {isAdmin ? (
              <Link to="/login" data-testid="auth-switch-member" className="font-medium text-primary hover:underline">
                Member sign in instead
              </Link>
            ) : isRegister ? (
              <span className="text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" data-testid="auth-switch-login" className="font-medium text-primary hover:underline">Sign in</Link>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/register" data-testid="auth-switch-register" className="font-medium text-primary hover:underline">Join the Dynasty</Link>
              </span>
            )}
          </div>

          {!isAdmin && (
            <div className="mt-4 text-center">
              <Link to="/admin-login" data-testid="auth-admin-link" className="text-xs text-muted-foreground hover:text-foreground">
                Want to login as admin?
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
