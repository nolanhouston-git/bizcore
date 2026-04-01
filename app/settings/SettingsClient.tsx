"use client";

import { useState } from "react";
import { updateSetting } from "./actions";
import { formatDate, formatDateTime, DateFormatKey } from "@/lib/dateFormat";

const C = {
  bg: "#080b12", surface: "#0f1420", surfaceB: "#141926", border: "#1e2535",
  borderHi: "#2a3550", accent: "#4f8ef7", accentDim: "#1e3a6e",
  green: "#34d399", greenDim: "#052e1a", textPri: "#e8edf5",
  textSec: "#8896b0", textDim: "#4a566e",
  mono: "'Fira Code','Cascadia Code',monospace", sans: "'Outfit','DM Sans',sans-serif",
};

const DATE_FORMATS: { key: DateFormatKey; label: string }[] = [
  { key: "Mon DD, YYYY", label: "Mon DD, YYYY" },
  { key: "MM/DD/YYYY",   label: "MM/DD/YYYY"   },
  { key: "YYYY-MM-DD",   label: "YYYY-MM-DD"   },
  { key: "DD/MM/YYYY",   label: "DD/MM/YYYY"   },
];

const PREVIEW_DATE     = "2026-03-18";
const PREVIEW_DATETIME = "2026-03-18T18:57:59";

export default function SettingsClient({ settings }: { settings: Record<string, string> }) {
  const [dateFormat, setDateFormat] = useState<DateFormatKey>(
    (settings.date_format as DateFormatKey) || "Mon DD, YYYY"
  );
  const [saved, setSaved] = useState(false);
  const [aiDocumentAccess, setAiDocumentAccess] = useState<boolean>(
    settings.ai_document_access !== undefined ? settings.ai_document_access === "on" : true
  );
  const [savedAI, setSavedAI] = useState(false);
  const [showLoanTx, setShowLoanTx] = useState<boolean>(
    settings.show_loan_transactions === "on"
  );
  const [savedLoanTx, setSavedLoanTx] = useState(false);

  const handleAiDocumentAccess = async (newValue: boolean) => {
    setAiDocumentAccess(newValue);
    setSavedAI(false);
    await updateSetting("ai_document_access", newValue ? "on" : "off");
    setSavedAI(true);
    setTimeout(() => setSavedAI(false), 2000);
  };

  const handleShowLoanTx = async (newValue: boolean) => {
    setShowLoanTx(newValue);
    setSavedLoanTx(false);
    await updateSetting("show_loan_transactions", newValue ? "on" : "off");
    setSavedLoanTx(true);
    setTimeout(() => setSavedLoanTx(false), 2000);
  };

  const handleDateFormat = async (fmt: DateFormatKey) => {
    setDateFormat(fmt);
    setSaved(false);
    await updateSetting("date_format", fmt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Date Format */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>Date Format</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                Applied to all dates across the app
              </div>
            </div>
            {saved && (
              <span style={{ fontSize: 12, color: C.green, fontFamily: C.mono }}>✓ Saved</span>
            )}
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {DATE_FORMATS.map(({ key, label }) => {
            const active = dateFormat === key;
            return (
              <button key={key} onClick={() => handleDateFormat(key)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: active ? C.accentDim : C.surfaceB,
                  border: `1px solid ${active ? C.accent : C.border}`,
                  borderRadius: 10, padding: "14px 18px", cursor: "pointer", textAlign: "left" as const }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%",
                    border: `2px solid ${active ? C.accent : C.borderHi}`,
                    background: active ? C.accent : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontFamily: C.mono, color: active ? C.accent : C.textSec, fontWeight: active ? 600 : 400 }}>
                      {label}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontSize: 13, fontFamily: C.mono, color: active ? C.accent : C.textDim }}>
                    {formatDate(PREVIEW_DATE, key)}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: C.mono, color: C.textDim, marginTop: 2 }}>
                    {formatDateTime(PREVIEW_DATETIME, key)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Document Access */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>AI Document Access</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                Allow AI features to read your uploaded documents for richer answers
              </div>
            </div>
            {savedAI && (
              <span style={{ fontSize: 12, color: C.green, fontFamily: C.mono }}>✓ Saved</span>
            )}
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ maxWidth: "75%" }}>
              <div style={{ fontSize: 13, color: C.textPri, fontWeight: 500 }}>Enable document context</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.5 }}>
                When on, the AI advisor will fetch relevant uploaded documents and include them as context.
                Turn off to limit AI to general knowledge only.
              </div>
            </div>
            <button
              onClick={() => handleAiDocumentAccess(!aiDocumentAccess)}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: aiDocumentAccess ? C.accent : C.borderHi,
                border: "none", cursor: "pointer", position: "relative" as const,
                transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute" as const, top: 3,
                left: aiDocumentAccess ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* Loan Transactions Visibility */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>Loan Transactions</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                Show loan-linked bank transactions in the Expenses and Income ledgers
              </div>
            </div>
            {savedLoanTx && (
              <span style={{ fontSize: 12, color: C.green, fontFamily: C.mono }}>✓ Saved</span>
            )}
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ maxWidth: "75%" }}>
              <div style={{ fontSize: 13, color: C.textPri, fontWeight: 500 }}>Show in ledgers</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 4, lineHeight: 1.5 }}>
                Loan transactions are balance sheet movements, not P&L. Hide them to keep
                your expense and income ledgers focused on operating activity.
              </div>
            </div>
            <button
              onClick={() => handleShowLoanTx(!showLoanTx)}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: showLoanTx ? C.accent : C.borderHi,
                border: "none", cursor: "pointer", position: "relative" as const,
                transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute" as const, top: 3,
                left: showLoanTx ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s",
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* Placeholder for future settings */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 24px", opacity: 0.5 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>Number Format</div>
        <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>Coming soon</div>
      </div>
    </div>
  );
}
