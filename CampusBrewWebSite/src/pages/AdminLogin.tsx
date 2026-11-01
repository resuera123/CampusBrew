import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken, clearToken } from "../lib/api";
import "../styles/admin.css";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      await api("/api/admin/applications?status=PENDING"); // 403 if not an admin
      navigate("/admin");
    } catch (err) {
      clearToken();
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="admin-login">
      <form onSubmit={handleSubmit}>
        <h1>CampusBrew Admin</h1>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="admin-error">{error}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}