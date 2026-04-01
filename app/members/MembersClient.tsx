"use client";

import React from "react";

import { useState, useRef } from "react";
import { addMember, updateMember, deactivateMember, reactivateMember } from "./actions";

type Member = {
  id: number;
  name: string;
  ownership_pct: number;
  annual_salary: number;
  role: string;
  active: number;
};

const C = {
  bg: "#080b12", surface: "#0f1420", surfaceB: "#141926", border: "#1e2535",
  borderHi: "#2a3550", accent: "#4f8ef7", accentDim: "#1e3a6e",
  gold: "#e8b84b", goldDim: "#3d2f0a", green: "#34d399", greenDim: "#052e1a",
  red: "#f87171", redDim: "#2d0a0a", purple: "#a78bfa",
  textPri: "#e8edf5", textSec: "#8896b0", textDim: "#4a566e",
  mono: "'Fira Code','Cascadia Code',monospace", sans: "'Outfit','DM Sans',sans-serif",
};

const ROLE_LABELS: Record<string, string> = { owner: "Owner", officer: "Officer", employee: "Employee" };
const ROLE_COLORS: Record<string, string> = { owner: C.accent, officer: C.purple, employee: C.gold };

function Tag({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}44`, borderRadius: 6,
      padding: "2px 10px", fontSize: 11, fontFamily: C.mono, textTransform: "uppercase" as const,
      letterSpacing: 0.8, whiteSpace: "nowrap" as const }}>
      {label}
    </span>
  );
}

function OwnershipWarning({ members, editingId, editingPct, editingRole }: {
  members: Member[]; editingId: number | null; editingPct: number; editingRole: string;
}) {
  const activeEquity = members.filter(m => m.active === 1 && m.role !== "employee");
  let sum = activeEquity.reduce((s, m) => {
    if (editingId !== null && m.id === editingId) return s;
    return s + m.ownership_pct;
  }, 0);
  if (editingId !== null && editingRole !== "employee") sum += editingPct;
  const diff = Math.abs(sum - 100);
  if (diff < 0.01) return null;
  const color = sum > 100 ? C.red : C.gold;
  const label = sum > 100
    ? `${sum.toFixed(2)}% — over by ${(sum - 100).toFixed(2)}%`
    : `${sum.toFixed(2)}% — ${(100 - sum).toFixed(2)}% unallocated`;
  return (
    <div style={{ background: color + "12", border: `1px solid ${color}44`, borderRadius: 8,
      padding: "10px 16px", fontSize: 12, color, display: "flex", alignItems: "center", gap: 8 }}>
      <span>⚠</span>
      <span>Owner/officer ownership totals {label}. Active owner and officer members must sum to 100%.</span>
    </div>
  );
}

function MemberForm({ initial, onSubmit, onCancel, submitLabel }: {
  initial?: Partial<Member>;
  onSubmit: (fd: FormData) => Promise<any>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [role, setRole] = useState(initial?.role || "officer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(formRef.current!);
    const result = await onSubmit(fd);
    setLoading(false);
    if (result?.error) setError(result.error);
  };

  const inputStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "9px 13px", color: C.textPri, fontSize: 13, fontFamily: C.sans,
    outline: "none", width: "100%", boxSizing: "border-box" as const,
  };
  const labelStyle = {
    fontSize: 11, color: C.textSec, fontWeight: 600, letterSpacing: 0.3,
    display: "block" as const, marginBottom: 4,
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Name *</label>
          <input name="name" defaultValue={initial?.name || ""} placeholder="Jane Smith" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <select name="role" value={role} onChange={e => setRole(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="owner">Owner</option>
            <option value="officer">Officer</option>
            <option value="employee">Employee</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Ownership %</label>
          <input name="ownership_pct" type="number" min="0" max="100" step="0.01"
            defaultValue={initial?.ownership_pct ?? ""} placeholder="0.00" style={inputStyle} />
          {role === "employee" && (
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 3 }}>Employees don&apos;t hold equity</div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Annual Salary ($)</label>
          <input name="annual_salary" type="number" min="0" step="1"
            defaultValue={initial?.annual_salary ?? ""} placeholder="75000" style={inputStyle} />
        </div>
      </div>
      {error && (
        <div style={{ background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 8,
          padding: "9px 14px", fontSize: 12, color: C.red, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={loading} style={{ background: `linear-gradient(135deg,${C.accent},#6366f1)`,
          border: "none", borderRadius: 8, padding: "9px 20px", color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: C.sans, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ background: "transparent",
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 16px",
            color: C.textDim, fontSize: 13, cursor: "pointer", fontFamily: C.sans }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default function MembersClient({ members }: { members: Member[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editRole, setEditRole] = useState("officer");
  const [editPct, setEditPct] = useState(0);
  const [showInactive, setShowInactive] = useState(false);

  const activeMembers = members.filter(m => m.active === 1);
  const inactiveMembers = members.filter(m => m.active === 0);
  const displayMembers = showInactive ? members : activeMembers;
  const activeEquitySum = activeMembers.filter(m => m.role !== "employee").reduce((s, m) => s + m.ownership_pct, 0);

  const handleUpdate = async (id: number, fd: FormData) => {
    const result = await updateMember(id, fd);
    if (!result?.error) setEditingId(null);
    return result;
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Deactivate this member? They will be excluded from all calculations but their history is preserved.")) return;
    await deactivateMember(id);
  };

  return (
    <div style={{ fontFamily: C.sans, color: C.textPri }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Active Members", value: activeMembers.length, color: C.accent },
          { label: "Ownership Allocated", value: `${activeEquitySum.toFixed(2)}%`, color: Math.abs(activeEquitySum - 100) < 0.01 ? C.green : C.gold },
          { label: "Total Payroll", value: `$${activeMembers.reduce((s, m) => s + m.annual_salary, 0).toLocaleString()}`, color: C.purple },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, background: C.surface, border: `1px solid ${color}44`,
            borderRadius: 12, padding: "16px 20px", boxShadow: `0 0 24px ${color}10` }}>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontFamily: C.mono, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontFamily: C.mono, color, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <OwnershipWarning members={members} editingId={editingId} editingPct={editPct} editingRole={editRole} />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${showAddForm ? C.accent + "44" : C.border}`,
        borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>
        <button onClick={() => setShowAddForm(v => !v)} style={{ width: "100%", background: "none", border: "none",
          padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between",
          alignItems: "center", color: showAddForm ? C.accent : C.textSec }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>+ Add Member or Employee</span>
          <span style={{ fontSize: 12, color: C.textDim }}>{showAddForm ? "▲ hide" : "▼ expand"}</span>
        </button>
        {showAddForm && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 14 }}>
              <strong style={{ color: C.textSec }}>Owner/Officer</strong> — holds equity, receives K-1 distributions, counted in the 100% ownership split.{" "}
              <strong style={{ color: C.textSec }}>Employee</strong> — W-2 only, no equity, reduces S-Corp net income as an IRC §162 deduction.
            </div>
            <MemberForm
              onSubmit={async fd => {
                const result = await addMember(fd);
                if (!result?.error) setShowAddForm(false);
                return result;
              }}
              onCancel={() => setShowAddForm(false)}
              submitLabel="Add Member"
            />
          </div>
        )}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase" }}>
            {showInactive ? "All Members" : "Active Members"}
          </span>
          {inactiveMembers.length > 0 && (
            <button onClick={() => setShowInactive(v => !v)} style={{ background: "transparent",
              border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 12px",
              color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: C.mono }}>
              {showInactive ? "Hide inactive" : `Show ${inactiveMembers.length} inactive`}
            </button>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Name", "Role", "Ownership", "Annual Salary", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 10,
                  color: C.textDim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: C.mono }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayMembers.map(member => (
              <React.Fragment key={member.id}>
                <tr style={{ borderBottom: editingId === member.id ? "none" : `1px solid ${C.border}22`,
                  opacity: member.active === 0 ? 0.5 : 1,
                  background: editingId === member.id ? C.surfaceB : "transparent" }}>
                  <td style={{ padding: "13px 20px", fontSize: 14, color: C.textPri, fontWeight: 500 }}>{member.name}</td>
                  <td style={{ padding: "13px 20px" }}>
                    <Tag label={ROLE_LABELS[member.role] || member.role} color={ROLE_COLORS[member.role] || C.textDim} />
                  </td>
                  <td style={{ padding: "13px 20px", fontSize: 13, fontFamily: C.mono, color: member.role === "employee" ? C.textDim : C.accent }}>
                    {member.role === "employee" ? "—" : `${member.ownership_pct.toFixed(2)}%`}
                  </td>
                  <td style={{ padding: "13px 20px", fontSize: 13, fontFamily: C.mono, color: C.textSec }}>
                    ${member.annual_salary.toLocaleString()}<span style={{ fontSize: 11, color: C.textDim, marginLeft: 6 }}>/yr</span>
                  </td>
                  <td style={{ padding: "13px 20px" }}>
                    <Tag label={member.active === 1 ? "Active" : "Inactive"} color={member.active === 1 ? C.green : C.textDim} />
                  </td>
                  <td style={{ padding: "13px 20px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {member.active === 1 ? (
                        <>
                          <button onClick={() => { setEditingId(editingId === member.id ? null : member.id); setEditRole(member.role); setEditPct(member.ownership_pct); }}
                            style={{ background: editingId === member.id ? C.accentDim : "transparent",
                              border: `1px solid ${editingId === member.id ? C.accent : C.borderHi}`,
                              borderRadius: 6, padding: "5px 12px", color: editingId === member.id ? C.accent : C.textSec,
                              fontSize: 12, cursor: "pointer", fontFamily: C.mono }}>
                            {editingId === member.id ? "Cancel" : "Edit"}
                          </button>
                          <button onClick={() => handleDeactivate(member.id)}
                            style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 6,
                              padding: "5px 12px", color: C.red, fontSize: 12, cursor: "pointer", fontFamily: C.mono }}>
                            Deactivate
                          </button>
                        </>
                      ) : (
                        <button onClick={() => reactivateMember(member.id)}
                          style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 6,
                            padding: "5px 12px", color: C.green, fontSize: 12, cursor: "pointer", fontFamily: C.mono }}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === member.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: "0 20px 20px", background: C.surfaceB, borderBottom: `1px solid ${C.border}22` }}>
                      <div style={{ borderTop: `1px solid ${C.accent}33`, paddingTop: 16, marginTop: 4 }}>
                        <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 1, marginBottom: 12 }}>
                          EDITING — {member.name}
                        </div>
                        <MemberForm
                          initial={member}
                          onSubmit={fd => handleUpdate(member.id, fd)}
                          onCancel={() => setEditingId(null)}
                          submitLabel="Save Changes"
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {displayMembers.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: C.textDim, fontSize: 13, fontFamily: C.mono }}>No members found.</div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
        <strong style={{ color: C.textSec }}>Note:</strong> Changes here update the Tax Advisor calculator immediately.
        Owner and officer members must sum to exactly 100% ownership.
        Employee members are excluded from the K-1 distribution calculation.
      </div>
    </div>
  );
}
