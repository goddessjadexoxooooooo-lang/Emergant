import { Link, useNavigate } from "react-router-dom";
import { Heart, LogOut, LayoutDashboard, Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export function JadeChip({ className = "", light = false }) {
  return (
    <span
      data-testid="jade-chip"
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] ${
        light ? "bg-white/20 text-white backdrop-blur-md" : "bg-primary/10 text-primary"
      } ${className}`}
    >
      <Heart className="h-3.5 w-3.5 fill-current" />
      Jade Dynasty
    </span>
  );
}

export function Navbar({ transparent = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className={`sticky top-0 z-40 ${
        transparent
          ? "bg-transparent"
          : "backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-jade"
      }`}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 h-18 py-4 flex items-center justify-between">
        <Link to="/" data-testid="brand-home-link" className="flex items-center gap-2.5">
          <span className={`grid h-9 w-9 place-items-center rounded-full ${transparent ? "bg-white/20 text-white" : "bg-primary text-primary-foreground"}`}>
            <Heart className="h-4.5 w-4.5 fill-current" />
          </span>
          <span className={`font-display text-2xl font-bold ${transparent ? "text-white" : "text-foreground"}`}>
            Jade &amp; Co.
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {user.role === "admin" && (
                <Button
                  data-testid="nav-admin-btn"
                  variant="ghost"
                  className="rounded-full gap-2"
                  onClick={() => navigate("/admin")}
                >
                  <Crown className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              <Button
                data-testid="nav-dashboard-btn"
                variant="ghost"
                className="rounded-full gap-2"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                data-testid="nav-logout-btn"
                variant="outline"
                className="rounded-full gap-2 bg-white"
                onClick={async () => { await logout(); navigate("/"); }}
              >
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                data-testid="nav-login-btn"
                variant="ghost"
                className={`rounded-full ${transparent ? "text-white hover:bg-white/15 hover:text-white" : ""}`}
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
              <Button
                data-testid="nav-join-btn"
                className="rounded-full px-5 shadow-jade transition-transform hover:-translate-y-0.5"
                onClick={() => navigate("/register")}
              >
                Join the Dynasty
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
