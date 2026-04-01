// Shared primitives used across all widget components.
// Import from here rather than redefining in each widget.

export const C = {
  bg: "#080b12", surface: "#0f1420", surfaceB: "#141926", border: "#1e2535",
  borderHi: "#2a3550", accent: "#4f8ef7", accentDim: "#1e3a6e",
  gold: "#e8b84b", goldDim: "#3d2f0a", green: "#34d399", greenDim: "#052e1a",
  red: "#f87171", redDim: "#2d0a0a", purple: "#a78bfa", pink: "#f472b6",
  teal: "#2dd4bf", textPri: "#e8edf5", textSec: "#8896b0", textDim: "#4a566e",
  mono: "'Fira Code','Cascadia Code',monospace", sans: "'Outfit','DM Sans',sans-serif",
};

export function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000)     return "$" + (n / 1_000).toFixed(1) + "K";
  return fmt(n);
}

export type WidgetShell = {
  children: React.ReactNode;
  editMode?: boolean;
  label?: string;
};

// Every widget is wrapped in this shell — provides consistent
// padding, background, and edit-mode drag handle styling.
export function WidgetShell({ children, editMode, label }: WidgetShell) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${editMode ? C.accent + "66" : C.border}`,
      borderRadius: 14,
      height: "100%",
      overflowY: "auto",
      boxSizing: "border-box" as const,
      display: "flex",
      flexDirection: "column" as const,
      position: "relative" as const,
      cursor: editMode ? "grab" : "default",
    }}>
      {editMode && (
        <div style={{
          position: "absolute" as const, top: 0, left: 0, right: 0,
          background: C.accent + "22", borderBottom: `1px solid ${C.accent}44`,
          padding: "4px 10px", fontSize: 10, color: C.accent,
          fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase" as const,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          zIndex: 10,
        }}>
          <span>⠿ {label}</span>
        </div>
      )}
      <div style={{ flex: 1, padding: editMode ? "28px 20px 16px" : "20px", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase" as const,
      letterSpacing: 1, fontFamily: C.mono, marginBottom: 6 }}>
      {children}
    </div>
  );
}

export function StatValue({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ fontSize: 26, fontFamily: C.mono, color, fontWeight: 700, lineHeight: 1.1 }}>
      {children}
    </div>
  );
}

export function Tag({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 8px", fontSize: 10, fontFamily: C.mono,
      textTransform: "uppercase" as const, letterSpacing: 0.8, whiteSpace: "nowrap" as const }}>
      {label}
    </span>
  );
}
