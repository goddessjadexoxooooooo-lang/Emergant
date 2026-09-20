import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const { loginWithSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash;
    const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
    if (!sid) {
      navigate("/login", { replace: true });
      return;
    }
    loginWithSession(sid)
      .then((user) => {
        window.history.replaceState(null, "", "/");
        navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [location.hash, loginWithSession, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="mt-4 text-muted-foreground">Entering the Dynasty…</p>
      </div>
    </div>
  );
}
