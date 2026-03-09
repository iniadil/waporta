import { useState, useEffect } from "react";
// const { version } = require("../../../package.json") as { version: string };
import { version } from "../../../package.json";

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const sec = String(s % 60).padStart(2, "0");
  const min = String(m % 60).padStart(2, "0");
  const hr = String(h).padStart(2, "0");
  return `${hr}:${min}:${sec}`;
}

interface Props {
  onLogout?: () => void
}

export function Header({ onLogout }: Props) {
  const [startTime] = useState(() => Date.now());
  const [uptime, setUptime] = useState("00:00:00");

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(formatUptime(Date.now() - startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <header
      style={{
        height: 48,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img
          src="/dashboard/waporta-logo-only.png"
          alt="waporta"
          style={{ height: 24, width: "auto" }}
        />
        <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: 0 }}>
          WAPORTA v{version}
        </span>
        <span className="blink" style={{ color: "var(--amber)", fontSize: 14 }}>
          _
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            color: "var(--text-dim)",
            fontSize: 11,
            letterSpacing: "0.08em",
          }}
        >
          UPTIME: <span style={{ color: "var(--text)" }}>{uptime}</span>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              padding: "4px 10px",
              border: "1px solid var(--border-bright)",
              color: "var(--text-dim)",
              fontSize: 10,
              letterSpacing: "0.1em",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)" }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >
            [ LOGOUT ]
          </button>
        )}
      </div>
    </header>
  );
}
