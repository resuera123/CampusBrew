import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken, clearToken } from "../lib/api";
import BrewBackground from "../components/BrewBackground";
import "../styles/admin.css";

// After this long, tell the admin why: the free backend sleeps when idle and
// can take up to a minute to wake.
const SLOW_MS = 4000;

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSlow(false);
    setLoading(true);
    try {
      const data = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setToken(data.token);
      await api("/api/admin/applications?status=PENDING"); // 403 if not an admin
      navigate("/admin");
    } catch (err) {
      clearToken();
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="admin-login">
      <BrewBackground />
      <form onSubmit={handleSubmit} aria-busy={loading}>
        <div className="admin-login-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
            <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
            <path d="M8 5.5c-.6-.8 0-1.7.6-2.2M12 5.5c-.6-.8 0-1.7.6-2.2" />
          </svg>
        </div>
        <h1>CampusBrew Admin</h1>
        <p className="admin-login-sub">Sign in to review applications and reports.</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading && <span className="admin-spinner" aria-hidden="true" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {loading && slow && (
          <p className="admin-login-note" role="status">
            Waking up the server — this can take up to a minute the first time.
          </p>
        )}
      </form>
      <Link to="/" className="admin-login-back">← Back to site</Link>
    </div>
  );
}
