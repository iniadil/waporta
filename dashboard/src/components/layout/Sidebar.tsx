type Page = "overview" | "sessions" | "messaging" | "checker" | "api-docs";

interface NavItem {
  id: Page;
  label: string;
  prefix: string;
}

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", prefix: "01" },
  { id: "sessions", label: "Sessions", prefix: "02" },
  { id: "messaging", label: "Messaging", prefix: "03" },
  { id: "checker", label: "Checker", prefix: "04" },
  { id: "api-docs", label: "API Docs", prefix: "05" },
];

interface Props {
  current: Page;
  onChange: (p: Page) => void;
}

export function Sidebar({ current, onChange }: Props) {
  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
        paddingTop: 16,
      }}
    >
      <nav>
        {navItems.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "9px 16px",
                background: active ? "var(--bg-hover)" : "none",
                borderLeft: active
                  ? "2px solid var(--amber)"
                  : "2px solid transparent",
                color: active ? "var(--amber)" : "var(--text-dim)",
                fontSize: 12,
                letterSpacing: "0.05em",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ color: "var(--border-bright)", fontSize: 10 }}>
                {item.prefix}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 0,
          width: "var(--sidebar-width)",
          padding: "0 16px",
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.08em",
        }}
      >
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          Created By{" "}
          <a
            href="https://github.com/iniadil"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            iniadil
          </a>
        </div>
      </div>
    </aside>
  );
}

export type { Page };
