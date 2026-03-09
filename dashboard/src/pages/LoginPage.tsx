import { useState, type FormEvent } from "react";
import { loginApi } from "../api/auth";
import { version as dashVersion } from "../../package.json";
import { version as apiVersion } from "../../../package.json";

interface Props {
  onLogin: (token: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await loginApi(username, password);
      onLogin(token);
    } catch {
      setError("INVALID CREDENTIALS");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: 360,
          border: "1px solid var(--border)",
          background: "var(--bg-panel)",
          padding: 32,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: "0.12em",
              marginBottom: 4,
            }}
          >
            WAPORTA / AUTH
          </div>
          <h1
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "var(--text-bright)",
            }}
          >
            Dashboard Login
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.1em",
              }}
            >
              USERNAME
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.1em",
              }}
            >
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ width: "100%" }}
            />
          </div>

          {error && (
            <div
              style={{
                color: "var(--red)",
                fontSize: 11,
                letterSpacing: "0.08em",
              }}
            >
              ✕ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              border: "1px solid var(--amber)",
              color: loading ? "var(--text-dim)" : "var(--amber)",
              fontSize: 11,
              letterSpacing: "0.1em",
              background: "none",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
            }}
          >
            {loading ? "AUTHENTICATING..." : "[ LOGIN ]"}
          </button>
        </form>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          DASHBOARD{" "}
          <span style={{ color: "var(--border-bright)" }}>v{dashVersion}</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          API{" "}
          <span style={{ color: "var(--border-bright)" }}>v{apiVersion}</span>
        </div>
      </div>
    </div>
  );
}
