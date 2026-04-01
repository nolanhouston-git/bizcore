"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ReactGridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-grid-layout/css/styles.css";

import { WIDGET_REGISTRY, DEFAULT_LAYOUT, LayoutItem } from "@/lib/widgets";
import { saveLayout, resetLayout } from "./actions";

import { YTDRevenueWidget, YTDExpensesWidget, NetIncomeWidget,
         PendingReviewWidget, CashRunwayWidget } from "./widgets/StatWidgets";
import { UpcomingTaxWidget }    from "./widgets/UpcomingTaxWidget";
import { DistributionsWidget }  from "./widgets/DistributionsWidget";
import { TaxSnapshotWidget }    from "./widgets/TaxSnapshotWidget";
import { SystemStatusWidget }   from "./widgets/SystemStatusWidget";
import { SpendingByCategoryWidget, RevenueByCategoryWidget,
         RevenueOverTimeWidget, IncomeVsExpensesWidget,
         CashFlowTrendWidget }  from "./widgets/ChartWidgets";

import type { DashboardData }   from "@/lib/dashboardData";

const C = {
  bg: "#080b12", surface: "#0f1420", surfaceB: "#141926", border: "#1e2535",
  accent: "#4f8ef7", accentDim: "#1e3a6e", green: "#34d399", red: "#f87171",
  gold: "#e8b84b", purple: "#a78bfa", textPri: "#e8edf5", textSec: "#8896b0",
  textDim: "#4a566e", mono: "'Fira Code','Cascadia Code',monospace",
  sans: "'Outfit','DM Sans',sans-serif",
};

const ROW_HEIGHT = 60;
const COLS       = 12;
const MARGIN: [number, number] = [12, 12];

function renderWidget(id: string, data: DashboardData, editMode: boolean, dateFormat: string) {
  const p = { data, editMode, dateFormat };
  switch (id) {
    case "ytd_revenue":         return <YTDRevenueWidget        {...p} />;
    case "ytd_expenses":        return <YTDExpensesWidget        {...p} />;
    case "net_income":          return <NetIncomeWidget           {...p} />;
    case "pending_review":      return <PendingReviewWidget       {...p} />;
    case "cash_runway":         return <CashRunwayWidget          {...p} />;
    case "upcoming_tax":        return <UpcomingTaxWidget         {...p} />;
    case "distributions":       return <DistributionsWidget       {...p} />;
    case "spending_by_category":return <SpendingByCategoryWidget  {...p} />;
    case "revenue_by_category": return <RevenueByCategoryWidget   {...p} />;
    case "revenue_over_time":   return <RevenueOverTimeWidget     {...p} />;
    case "income_vs_expenses":  return <IncomeVsExpensesWidget    {...p} />;
    case "cash_flow_trend":     return <CashFlowTrendWidget       {...p} />;
    case "tax_snapshot":        return <TaxSnapshotWidget         {...p} />;
    case "system_status":       return <SystemStatusWidget        {...p} />;
    default: return (
      <div style={{ padding: 20, color: C.textDim, fontFamily: C.mono, fontSize: 12 }}>
        Unknown widget: {id}
      </div>
    );
  }
}

type Props = {
  data: DashboardData;
  initialLayout: LayoutItem[];
  dateFormat: string;
  containerWidth: number;
};

export default function DashboardClient({ data, initialLayout, dateFormat, containerWidth }: Props) {
  const [layout, setLayout]       = useState<LayoutItem[]>(initialLayout);
  const [editMode, setEditMode]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [gridWidth, setGridWidth] = useState(containerWidth);
  const containerRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setGridWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-save layout to DB after changes, debounced 800ms
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveLayout(layout);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [layout]);

  const visibleItems  = layout.filter(l => l.visible);
  const hiddenItems   = layout.filter(l => !l.visible);

  // Convert LayoutItem[] → react-grid-layout Layout[]
  const gridLayout = visibleItems.map(item => ({
    i: item.i, x: item.x, y: item.y, w: item.w, h: item.h,
    minW: WIDGET_REGISTRY[item.i]?.minW ?? 1,
    minH: WIDGET_REGISTRY[item.i]?.minH ?? 1,
  }));

  const onLayoutChange = useCallback((newLayout: readonly any[]) => {
    setLayout(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i);
      if (!updated) return item;
      return { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h };
    }));
  }, []);

  const hideWidget = (id: string) => {
    setLayout(prev => prev.map(l => l.i === id ? { ...l, visible: false } : l));
  };

  const showWidget = (id: string) => {
    const def = WIDGET_REGISTRY[id];
    setLayout(prev => prev.map(l => l.i === id
      ? { ...l, visible: true, w: def.defaultLayout.w, h: def.defaultLayout.h }
      : l
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveLayout(layout);
    setSaving(false);
    setEditMode(false);
  };

  const handleReset = async () => {
    if (!confirm("Reset dashboard to default layout?")) return;
    setSaving(true);
    await resetLayout();
    setLayout(DEFAULT_LAYOUT);
    setSaving(false);
    setEditMode(false);
  };

  return (
    <div ref={containerRef} style={{ fontFamily: C.sans, color: C.textPri }}>

      {/* Dashboard header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textPri, margin: 0 }}>Dashboard</h1>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>
            {data.businessName}{data.businessDba ? ` — ${data.businessDba}` : ""} · {new Date().getFullYear()} overview
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {editMode && (
            <>
              <button onClick={handleReset} disabled={saving}
                style={{ background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "8px 16px", color: C.textDim,
                  fontSize: 12, cursor: "pointer", fontFamily: C.sans }}>
                Reset to Default
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: `linear-gradient(135deg,${C.accent},#6366f1)`,
                  border: "none", borderRadius: 8, padding: "8px 20px", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: C.sans,
                  opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save Layout"}
              </button>
            </>
          )}
          <button onClick={() => setEditMode(v => !v)}
            style={{ background: editMode ? C.accentDim : "transparent",
              border: `1px solid ${editMode ? C.accent : C.border}`,
              borderRadius: 8, padding: "8px 16px",
              color: editMode ? C.accent : C.textSec,
              fontSize: 12, cursor: "pointer", fontFamily: C.sans, fontWeight: editMode ? 600 : 400 }}>
            {editMode ? "✕ Exit Edit" : "⊞ Customize"}
          </button>
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div style={{ background: C.accentDim, border: `1px solid ${C.accent}44`,
          borderRadius: 10, padding: "10px 16px", marginBottom: 16,
          fontSize: 12, color: C.accent, display: "flex", alignItems: "center", gap: 8 }}>
          <span>⠿</span>
          <span>Drag widgets to reposition · Resize from the bottom-right corner · Hide widgets with ✕ · Add hidden widgets below</span>
        </div>
      )}

      {/* Hidden widgets picker — only in edit mode, shown above grid */}
      {editMode && hiddenItems.length > 0 && (
        <div style={{ marginBottom: 16, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, letterSpacing: 1,
            textTransform: "uppercase", marginBottom: 12 }}>
            Hidden Widgets — click to add
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {hiddenItems.map(item => {
              const def = WIDGET_REGISTRY[item.i];
              if (!def) return null;
              return (
                <button key={item.i} onClick={() => showWidget(item.i)}
                  style={{ background: C.surfaceB, border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                    textAlign: "left" as const, display: "flex", flexDirection: "column" as const, gap: 3,
                    minWidth: 140 }}>
                  <div style={{ fontSize: 12, color: C.textPri, fontWeight: 600 }}>{def.label}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{def.description}</div>
                  <div style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, marginTop: 2 }}>+ Add</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      <ReactGridLayout
        layout={gridLayout}
        width={gridWidth}
        gridConfig={{ cols: COLS, rowHeight: ROW_HEIGHT, margin: MARGIN }}
        dragConfig={{ enabled: editMode, handle: ".drag-handle" }}
        resizeConfig={{ enabled: editMode }}
        onLayoutChange={onLayoutChange}
      >
        {visibleItems.map(item => {
          return (
            <div key={item.i} style={{ position: "relative" }}>
              {editMode && (
                <>
                  <div className="drag-handle" style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    height: "36px", zIndex: 15, cursor: "grab",
                    borderRadius: 14,
                  }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); hideWidget(item.i); }}
                    style={{ position: "absolute", top: 6, right: 6, zIndex: 20,
                      background: C.surface, border: `1px solid ${C.border}`,
                      borderRadius: "50%", width: 22, height: 22,
                      color: C.textDim, fontSize: 11, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      lineHeight: 1 }}>
                    ✕
                  </button>
                </>
              )}
              {renderWidget(item.i, data, editMode, dateFormat)}
            </div>
          );
        })}
      </ReactGridLayout>


    </div>
  );
}
