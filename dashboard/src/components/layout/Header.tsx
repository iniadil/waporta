import { useState, useEffect } from "react";

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const sec = String(s % 60).padStart(2, "0");
  const min = String(m % 60).padStart(2, "0");
  const hr = String(h).padStart(2, "0");
  return `${hr}:${min}:${sec}`;
}

export function Header() {
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
        <span
          style={{
            color: "var(--amber)",
            fontWeight: 600,
            letterSpacing: "0.12em",
            fontSize: 14,
          }}
        >
          WA-PORTA
        </span>
        <span className="blink" style={{ color: "var(--amber)", fontSize: 14 }}>
          _
        </span>
        <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: 8 }}>
          DASHBOARD v1.0
        </span>
      </div>
      <div
        style={{
          color: "var(--text-dim)",
          fontSize: 11,
          letterSpacing: "0.08em",
        }}
      >
        UPTIME: <span style={{ color: "var(--text)" }}>{uptime}</span>
      </div>
    </header>
  );
}
