"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { formatDate } from "@/lib/dateFormat";
import { markObligationComplete } from "./actions";

export type Obligation = {
  id: number;
  name: string;
  category: string | null;
  jurisdiction: string | null;
  recurrence: string | null;
  due_date: string | null;
  days_until_due: number;
  status: "compliant" | "overdue" | "due_soon" | "upcoming";
  source_url: string | null;
  notes: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  period_label: string | null;
};

type Props = {
  obligations: Obligation[];
  summary: { overdue: number; due_soon: number; compliant: number; upcoming: number };
  currentYear: number;
  gapResult: string | null;
  gapRanAt: string | null;
  gapIsStale: boolean;
  dateFormat?: string;
};

const STATUS_CONFIG: Record<
  Obligation["status"],
  { label: string; badge: string }
> = {
  overdue:   { label: "Overdue",   badge: "bg-[#2d0a0a] text-[#f87171] border-[#f87171]/30" },
  due_soon:  { label: "Due Soon",  badge: "bg-[#3d2f0a] text-[#e8b84b] border-[#e8b84b]/30" },
  compliant: { label: "Compliant", badge: "bg-[#052e1a] text-[#34d399] border-[#34d399]/30" },
  upcoming:  { label: "Upcoming",  badge: "bg-[#1e2535] text-[#8896b0] border-[#2a3550]"    },
};

const JURISDICTION_COLORS: Record<string, string> = {
  "Federal":     "bg-[#1e2d4a] text-[#4f8ef7] border-[#4f8ef7]/30",
  "WA State":    "bg-[#042f2e] text-[#2dd4bf] border-[#2dd4bf]/30",
  "Seattle":     "bg-[#2a1a3e] text-[#a78bfa] border-[#a78bfa]/30",
  "King County": "bg-[#3b0a2a] text-[#f472b6] border-[#f472b6]/30",
  "Employment":  "bg-[#3d2f0a] text-[#e8b84b] border-[#e8b84b]/30",
};

export default function ComplianceClient({
  obligations,
  summary,
  currentYear,
  gapResult,
  gapRanAt,
  gapIsStale,
  dateFormat = "Mon DD, YYYY",
}: Props) {
  const [activeTab, setActiveTab] = useState<"obligations" | "advisor">("obligations");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Gap Analysis state
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const [liveGapResult, setLiveGapResult] = useState(gapResult ?? "");

  // Chat state
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  const markdownComponents = {
    h1: ({children}: {children?: React.ReactNode}) => <h1 style={{fontSize:'1.2rem', fontWeight:700, color:'#e8edf5', marginBottom:'0.5rem', marginTop:'1rem'}}>{children}</h1>,
    h2: ({children}: {children?: React.ReactNode}) => <h2 style={{fontSize:'1.05rem', fontWeight:700, color:'#e8edf5', marginBottom:'0.4rem', marginTop:'0.9rem'}}>{children}</h2>,
    h3: ({children}: {children?: React.ReactNode}) => <h3 style={{fontSize:'0.95rem', fontWeight:600, color:'#e8edf5', marginBottom:'0.3rem', marginTop:'0.7rem'}}>{children}</h3>,
    p: ({children}: {children?: React.ReactNode}) => <p style={{color:'#c8d0dc', marginBottom:'0.5rem', lineHeight:'1.6', fontSize:'0.875rem'}}>{children}</p>,
    strong: ({children}: {children?: React.ReactNode}) => <strong style={{color:'#e8edf5', fontWeight:600}}>{children}</strong>,
    ul: ({children}: {children?: React.ReactNode}) => <ul style={{paddingLeft:'1.25rem', marginBottom:'0.5rem'}}>{children}</ul>,
    ol: ({children}: {children?: React.ReactNode}) => <ol style={{paddingLeft:'1.25rem', marginBottom:'0.5rem'}}>{children}</ol>,
    li: ({children}: {children?: React.ReactNode}) => <li style={{color:'#c8d0dc', marginBottom:'0.25rem', fontSize:'0.875rem'}}>{children}</li>,
    code: ({children}: {children?: React.ReactNode}) => <code style={{background:'#1e2535', color:'#4f8ef7', padding:'0.1rem 0.3rem', borderRadius:'0.25rem', fontSize:'0.8rem', fontFamily:'monospace'}}>{children}</code>,
    hr: () => <hr style={{borderColor:'#1e2535', margin:'0.75rem 0'}} />,
  };

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [warnNoFile, setWarnNoFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleComplete(obligationId: number, currentYear: number, skipFileCheck = false) {
    if (!skipFileCheck && !fileRef.current?.files?.[0]) {
      setWarnNoFile(true);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const fd = new FormData();
    if (fileRef.current?.files?.[0]) {
      fd.append("document", fileRef.current.files[0]);
    }
    const { error } = await markObligationComplete(obligationId, String(currentYear), notes, fd);
    setSubmitting(false);
    if (error) {
      setFormError(error);
    } else {
      setExpandedId(null);
      setNotes("");
      setFileName("");
      setWarnNoFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }} className="text-[#e8edf5]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#e8edf5]">Compliance Tracker</h1>
          <p className="text-sm text-[#4a566e] font-mono mt-1">{currentYear} obligations</p>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Overdue",   value: summary.overdue,   color: "text-[#f87171]", border: "border-[#f87171]/20" },
            { label: "Due Soon",  value: summary.due_soon,  color: "text-[#e8b84b]", border: "border-[#e8b84b]/20" },
            { label: "Compliant", value: summary.compliant, color: "text-[#34d399]", border: "border-[#34d399]/20" },
            { label: "Upcoming",  value: summary.upcoming,  color: "text-[#8896b0]", border: "border-[#2a3550]"    },
          ].map(({ label, value, color, border }) => (
            <div key={label} className={`bg-[#0f1420] border ${border} rounded-2xl p-5`}>
              <p className="font-mono text-xs text-[#4a566e] uppercase tracking-widest mb-2">{label}</p>
              <p className={`font-mono text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-[#1e2535]">
          {(["obligations", "advisor"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? "text-[#4f8ef7]"
                  : "text-[#4a566e] hover:text-[#8896b0]"
              }`}
            >
              {tab === "obligations" ? "Obligations" : "AI Advisor"}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4f8ef7] rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* ── OBLIGATIONS TAB ── */}
        {activeTab === "obligations" && (
          <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#1e2535]">
                  {["Obligation", "Jurisdiction", "Due Date", "Status", "Action"].map(h => (
                    <th key={h} className="text-left p-4 font-mono text-xs text-[#4a566e] uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {obligations.map(ob => {
                  const cfg = STATUS_CONFIG[ob.status];
                  const jurisdictionClass =
                    ob.jurisdiction && JURISDICTION_COLORS[ob.jurisdiction]
                      ? JURISDICTION_COLORS[ob.jurisdiction]
                      : "bg-[#1e2535] text-[#8896b0] border-[#2a3550]";

                  return (
                    <tr key={ob.id} className="border-b border-[#1e2535]/50 hover:bg-[#141926] transition-colors">

                      {/* Obligation */}
                      <td className="p-4 max-w-[280px]">
                        <div className="text-sm font-medium text-[#e8edf5]">{ob.name}</div>
                        {ob.category && (
                          <div className="text-xs text-[#4a566e] font-mono mt-0.5">{ob.category}</div>
                        )}
                        {ob.notes && (
                          <div className="text-xs text-[#8896b0] mt-1 leading-relaxed">{ob.notes}</div>
                        )}
                      </td>

                      {/* Jurisdiction */}
                      <td className="p-4">
                        {ob.jurisdiction ? (
                          <span className={`border rounded px-2 py-0.5 text-xs font-mono ${jurisdictionClass}`}>
                            {ob.jurisdiction}
                          </span>
                        ) : (
                          <span className="text-[#4a566e] text-xs font-mono">—</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="p-4">
                        <div className="text-sm font-mono text-[#e8edf5]">
                          {ob.due_date ? formatDate(ob.due_date, dateFormat) : "—"}
                        </div>
                        {ob.due_date && ob.status !== "compliant" && (
                          <div className={`text-xs font-mono mt-0.5 ${ob.days_until_due < 0 ? "text-[#f87171]" : "text-[#e8b84b]"}`}>
                            {ob.days_until_due < 0
                              ? `${Math.abs(ob.days_until_due)}d past due`
                              : `${ob.days_until_due}d remaining`}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`border rounded px-2 py-0.5 text-xs font-mono uppercase tracking-wider ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {ob.completed_at && (
                          <div className="text-xs text-[#4a566e] font-mono mt-1">
                            {formatDate(ob.completed_at.slice(0, 10), dateFormat)}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-4">
                        {ob.status === "compliant" ? (
                          <span className="text-xs text-[#34d399] font-mono">Done</span>
                        ) : expandedId !== ob.id ? (
                          <button
                            onClick={() => setExpandedId(ob.id)}
                            className="bg-[#4f8ef7]/10 border border-[#4f8ef7]/30 text-[#4f8ef7] rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#4f8ef7]/20 transition-colors whitespace-nowrap"
                          >
                            Mark Complete
                          </button>
                        ) : (
                          <>
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <textarea
                                placeholder="Optional notes..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                className="w-full text-xs bg-[#080b12] border border-[#1e2535] rounded p-1.5 text-[#e8edf5] placeholder-[#4a566e] resize-none"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  ref={fileRef}
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                  className="hidden"
                                  onChange={() => setFileName(fileRef.current?.files?.[0]?.name ?? "")}
                                />
                                <button
                                  type="button"
                                  onClick={() => fileRef.current?.click()}
                                  className="bg-[#080b12] border border-[#1e2535] text-[#8896b0] hover:text-[#e8edf5] hover:border-[#2a3550] rounded px-2 py-1 text-xs transition-colors"
                                >
                                  ↑ Attach
                                </button>
                                <span className="text-xs text-[#4a566e] truncate max-w-[120px]">
                                  {fileName || "No file attached"}
                                </span>
                              </div>
                              {warnNoFile ? (
                                <div className="flex flex-col gap-1.5">
                                  <p className="text-xs text-[#e8b84b]">No document attached — are you sure?</p>
                                  <div className="flex gap-2 items-center">
                                    <button
                                      onClick={() => setWarnNoFile(false)}
                                      className="bg-[#4f8ef7] text-white rounded px-3 py-1 text-xs font-medium"
                                    >
                                      Attach a file
                                    </button>
                                    <button
                                      onClick={() => handleComplete(ob.id, currentYear, true)}
                                      disabled={submitting}
                                      className="bg-[#1e2535] border border-[#2a3550] text-[#8896b0] hover:text-[#e8edf5] rounded px-3 py-1 text-xs font-medium disabled:opacity-50 transition-colors"
                                    >
                                      {submitting ? "Saving..." : "Submit anyway"}
                                    </button>
                                    <button
                                      onClick={() => { setExpandedId(null); setNotes(""); setWarnNoFile(false); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                                      className="text-xs text-[#4a566e] hover:text-[#8896b0] transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2 items-center">
                                  <button
                                    onClick={() => handleComplete(ob.id, currentYear)}
                                    disabled={submitting}
                                    className="bg-[#4f8ef7] text-white rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
                                  >
                                    {submitting ? "Saving..." : "Confirm"}
                                  </button>
                                  <button
                                    onClick={() => { setExpandedId(null); setNotes(""); setFileName(""); setWarnNoFile(false); if (fileRef.current) fileRef.current.value = ""; }}
                                    className="text-xs text-[#4a566e] hover:text-[#8896b0] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                              {formError && (
                                <p className="text-xs text-[#f87171]">{formError}</p>
                              )}
                            </div>
                          </>
                        )}
                        {ob.source_url && (
                          <div className="mt-1.5">
                            <a
                              href={ob.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#4a566e] hover:text-[#4f8ef7] transition-colors font-mono underline underline-offset-2"
                            >
                              Official site
                            </a>
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── AI ADVISOR TAB ── */}
        {activeTab === "advisor" && (
          <div className="flex flex-col gap-6">

            {/* ── SECTION 1: Gap Analysis ── */}
            <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl p-6">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[#e8edf5]">Gap Analysis</h2>
                <p className="text-xs text-[#4a566e] mt-0.5">Scan for missing compliance obligations based on your business profile</p>
              </div>

              {gapIsStale && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-[#3d2f0a] border border-[#e8b84b]/30 text-xs text-[#e8b84b]">
                  Analysis may be outdated — results below are from a previous run
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <button
                  disabled={gapLoading}
                  onClick={async () => {
                    setGapLoading(true);
                    setGapError(null);
                    setLiveGapResult("");
                    try {
                      const res = await fetch("/api/compliance/gap-analysis", { method: "POST", body: "" });
                      if (!res.ok || !res.body) throw new Error("Request failed");
                      const reader = res.body.getReader();
                      const decoder = new TextDecoder();
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        setLiveGapResult(prev => prev + decoder.decode(value, { stream: true }));
                      }
                    } catch (e) {
                      setGapError(e instanceof Error ? e.message : "Unknown error");
                    } finally {
                      setGapLoading(false);
                    }
                  }}
                  className="bg-[#4f8ef7]/10 border border-[#4f8ef7]/30 text-[#4f8ef7] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#4f8ef7]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {gapLoading ? "Analyzing..." : liveGapResult ? "Re-run Analysis" : "Run Gap Analysis"}
                </button>
                {gapRanAt && (
                  <span className="text-xs text-[#4a566e] font-mono">
                    Last analyzed: {formatDate(gapRanAt.slice(0, 10), dateFormat)}
                  </span>
                )}
              </div>

              {gapError && (
                <p className="text-xs text-[#f87171] mb-3">{gapError}</p>
              )}

              {liveGapResult && (
                <div className="bg-[#080b12] border border-[#1e2535] rounded-xl p-4 leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>{liveGapResult}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* divider */}
            <div className="border-t border-[#1e2535]" />

            {/* ── SECTION 2: Chat ── */}
            <div className="bg-[#0f1420] border border-[#1e2535] rounded-2xl p-6 flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#e8edf5]">Ask a Question</h2>
              </div>

              {/* Message history */}
              <div className="max-h-96 overflow-y-auto flex flex-col gap-3 pr-1">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#1e3a6e] text-[#e8edf5] border border-[#4f8ef7]/30"
                          : "bg-[#141926] text-[#8896b0] border border-[#1e2535]"
                      }`}
                    >
                      {msg.role === "user" ? msg.content : (
                        <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && streamingResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-[#141926] text-[#8896b0] border border-[#1e2535]">
                      <ReactMarkdown components={markdownComponents}>{streamingResponse}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {chatLoading && !streamingResponse && (
                  <div className="flex justify-start">
                    <div className="rounded-xl px-4 py-2.5 text-xs font-mono text-[#4a566e] bg-[#141926] border border-[#1e2535]">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>

              {/* Input row */}
              <div className="flex gap-2 items-end">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatInput.trim() || chatLoading) return;
                      const userMsg = chatInput.trim();
                      const historySnapshot = chatHistory;
                      setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
                      setChatInput("");
                      setChatLoading(true);
                      setStreamingResponse("");
                      let full = "";
                      try {
                        const res = await fetch("/api/compliance/chat", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ message: userMsg, history: historySnapshot }),
                        });
                        if (!res.ok || !res.body) throw new Error("Request failed");
                        const reader = res.body.getReader();
                        const decoder = new TextDecoder();
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          const chunk = decoder.decode(value, { stream: true });
                          full += chunk;
                          setStreamingResponse(full);
                        }
                      } catch {
                        full = "Error: could not get a response.";
                      } finally {
                        setChatHistory(prev => [...prev, { role: "assistant", content: full }]);
                        setStreamingResponse("");
                        setChatLoading(false);
                      }
                    }
                  }}
                  placeholder="Ask a compliance question… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={chatLoading}
                  className="flex-1 text-sm bg-[#080b12] border border-[#1e2535] rounded-xl px-4 py-2.5 text-[#e8edf5] placeholder-[#4a566e] resize-none disabled:opacity-50 focus:outline-none focus:border-[#4f8ef7]/50"
                />
                <button
                  disabled={chatLoading || !chatInput.trim()}
                  onClick={async () => {
                    if (!chatInput.trim() || chatLoading) return;
                    const userMsg = chatInput.trim();
                    const historySnapshot = chatHistory;
                    setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
                    setChatInput("");
                    setChatLoading(true);
                    setStreamingResponse("");
                    let full = "";
                    try {
                      const res = await fetch("/api/compliance/chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message: userMsg, history: historySnapshot }),
                      });
                      if (!res.ok || !res.body) throw new Error("Request failed");
                      const reader = res.body.getReader();
                      const decoder = new TextDecoder();
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        full += chunk;
                        setStreamingResponse(full);
                      }
                    } catch {
                      full = "Error: could not get a response.";
                    } finally {
                      setChatHistory(prev => [...prev, { role: "assistant", content: full }]);
                      setStreamingResponse("");
                      setChatLoading(false);
                    }
                  }}
                  className="bg-[#4f8ef7] text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-[#4f8ef7]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Send
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
