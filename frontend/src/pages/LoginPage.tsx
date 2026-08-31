import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Role } from "../types";

const ROLE_PATHS: Record<Role, string> = {
  retailer_staff: "/retailer",
  dispatcher: "/dispatcher",
  rider: "/rider",
};

// Eye-open SVG
function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// Eye-closed SVG
function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>("/auth/login", {
        phone,
        password,
      });
      const payload = JSON.parse(atob(res.access_token.split(".")[1]));
      login(res.access_token, payload.role as Role, Number(payload.sub));
      navigate(ROLE_PATHS[payload.role as Role] ?? "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/logo.png" alt="Reflex" style={{ height: 52, marginBottom: 16 }} />
        <p style={styles.subtitle}>Sign in to your account</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Phone number</label>
          <input
            style={styles.input}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0712345678"
            required
          />
          <label style={styles.label}>Password</label>
          {/* Password field with show/hide toggle */}
          <div style={styles.passwordWrap}>
            <input
              style={styles.passwordInput}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={styles.backLink}>
          <a href="/" style={{ color: "#1d4ed8", textDecoration: "none", fontSize: 13 }}>
            ← Back to home
          </a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "36px 36px 28px",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  subtitle: { margin: "0 0 22px", color: "#6b7280", fontSize: 14, alignSelf: "flex-start" },
  form: { display: "flex", flexDirection: "column", gap: 12, width: "100%" },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  input: {
    padding: "9px 12px",
    borderRadius: 7,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  passwordWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  passwordInput: {
    padding: "9px 40px 9px 12px",
    borderRadius: 7,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: 10,
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    padding: "2px 4px",
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
  },
  error: { color: "#dc2626", fontSize: 13, margin: 0 },
  button: {
    marginTop: 6,
    padding: "10px 0",
    borderRadius: 7,
    border: "none",
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    width: "100%",
  },
  backLink: { marginTop: 18, alignSelf: "flex-start" },
};
