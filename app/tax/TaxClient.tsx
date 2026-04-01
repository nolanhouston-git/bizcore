"use client";

import { useState, useTransition } from "react";
import {
  TaxBracket,
  TaxDeadline,
  DeadlineCompletion,
  ExpenseByCategory,
  BusinessMember,
} from "./page";
import { formatDate, type DateFormatKey } from "@/lib/dateFormat";

type Tab = "calculator" | "calendar" | "deductions" | "taxcode";

type DeadlineInstance = {
  deadline: TaxDeadline;
  dueDate: Date;
  period: string;
  isComplete: boolean;
  daysUntil: number;
};

type Props = {
  grossRevenueFromDB: number;
  expensesByCategory: ExpenseByCategory[];
  taxRules: Record<string, number>;
  taxBrackets: TaxBracket[];
  deadlines: TaxDeadline[];
  completions: DeadlineCompletion[];
  members: BusinessMember[];
  entityType: string;
  dateFormat: DateFormatKey;
};

const C = {
  bg:"#080b12", surface:"#0f1420", surfaceB:"#141926", border:"#1e2535",
  accent:"#4f8ef7", gold:"#e8b84b", green:"#34d399", red:"#f87171",
  purple:"#a78bfa", teal:"#2dd4bf", textPri:"#e8edf5", textSec:"#8896b0",
  textDim:"#4a566e", mono:"'Fira Code','Cascadia Code',monospace",
  sans:"'Outfit','DM Sans',sans-serif",
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) => (n * 100).toFixed(2) + "%";

function calcIncomeTax(taxableIncome: number, brackets: TaxBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.bracket_min) break;
    const ceiling = bracket.bracket_max ?? Infinity;
    const taxable = Math.min(taxableIncome, ceiling) - bracket.bracket_min;
    tax += taxable * bracket.rate;
  }
  return tax;
}

function generateDeadlines(
  deadlines: TaxDeadline[],
  completions: DeadlineCompletion[],
  year: number
): DeadlineInstance[] {
  const today = new Date();
  const completionSet = new Set(completions.map((c) => `${c.deadline_id}:${c.period}`));
  const instances: DeadlineInstance[] = [];

  for (const deadline of deadlines) {
    if (deadline.recurrence === "annual") {
      const dueDate = new Date(year, (deadline.due_month ?? 1) - 1, deadline.due_day ?? 1);
      const period = String(year);
      const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
      instances.push({ deadline, dueDate, period, isComplete: completionSet.has(`${deadline.id}:${period}`), daysUntil });
    }

    if (deadline.recurrence === "quarterly") {
      const quarters = [
        { period: "Q1", dueMonth: 3, dueYear: year },
        { period: "Q2", dueMonth: 6, dueYear: year },
        { period: "Q3", dueMonth: 9, dueYear: year },
        { period: "Q4", dueMonth: 0, dueYear: year + 1 },
      ];
      for (const q of quarters) {
        const lastDay = new Date(q.dueYear, q.dueMonth + 1, 0).getDate();
        const dueDate = new Date(q.dueYear, q.dueMonth, lastDay);
        const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
        instances.push({ deadline, dueDate, period: q.period, isComplete: completionSet.has(`${deadline.id}:${q.period}`), daysUntil });
      }
    }

    if (deadline.recurrence === "monthly") {
      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      for (let month = 0; month < 12; month++) {
        const dueMonth = month + 1;
        const dueYear = dueMonth > 11 ? year + 1 : year;
        const actualDueMonth = dueMonth > 11 ? 0 : dueMonth;
        const dueDate = new Date(dueYear, actualDueMonth, deadline.due_day_of_month ?? 25);
        const period = monthNames[month];
        const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
        instances.push({ deadline, dueDate, period, isComplete: completionSet.has(`${deadline.id}:${period}`), daysUntil });
      }
    }
  }

  return instances.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

const SCORP_DEDUCTIONS = [
  { category:"Payroll", label:"W-2 Salaries & Payroll Taxes", irc:"IRC §162", description:"Owner W-2 salaries and employer payroll taxes are fully deductible. The S-Corp structure separates salary income (subject to FICA) from distributions (not subject to SE tax).", tip:"Ensure salaries are 'reasonable compensation' per IRS standards to avoid reclassification." },
  { category:"Software", label:"Software & SaaS Subscriptions", irc:"IRC §162", description:"Business software, SaaS tools, and technology subscriptions are fully deductible as ordinary business expenses.", tip:"Keep receipts showing business purpose for each subscription." },
  { category:"Research", label:"Research & Survey Costs", irc:"IRC §162 / §174", description:"Direct research costs including panel recruitment, survey tools, and participant incentives are deductible. May qualify for R&D credit under §41.", tip:"Document research purpose and client relationship for each project expenditure." },
  { category:"Professional Services", label:"Professional & Legal Fees", irc:"IRC §162", description:"CPA, attorney, and consulting fees paid for business purposes are fully deductible.", tip:"Fees for personal tax advice are not deductible — ensure invoices reflect business services only." },
  { category:"Marketing", label:"Marketing & Advertising", irc:"IRC §162", description:"Advertising, marketing campaigns, and business development costs are fully deductible.", tip:null },
  { category:"Travel", label:"Business Travel", irc:"IRC §162", description:"Travel costs for client meetings, conferences, and business development are deductible. Meals are 50% deductible.", tip:"Keep a travel log with business purpose, destination, and who you met." },
  { category:"Rent", label:"Office Rent", irc:"IRC §162", description:"Rent paid for office or workspace used exclusively for business is fully deductible.", tip:"Home office deduction available if you work from home (IRC §280A) — requires exclusive-use room." },
  { category:"Utilities", label:"Utilities", irc:"IRC §162", description:"Utilities for your business location are deductible. If home office, only the business-use percentage applies.", tip:null },
  { category:"Supplies", label:"Office Supplies", irc:"IRC §162", description:"Office supplies and materials consumed in the business are fully deductible in the year purchased.", tip:null },
  { category:"Banking", label:"Bank Fees & Interest", irc:"IRC §162 / §163", description:"Business bank fees are deductible under §162. Business loan interest is deductible under §163.", tip:"Personal bank fees mixed with business fees are not deductible — use a dedicated business account." },
];

const TAX_CODE_REFS = [
  { group:"Federal — S-Corporation", items:[
    { cite:"IRC §1361–1379", label:"S-Corporation Rules", description:"Defines S-Corp eligibility, election procedures, shareholder limits, and pass-through taxation mechanics.", url:"https://www.law.cornell.edu/uscode/text/26/1361" },
    { cite:"IRC §162", label:"Ordinary & Necessary Business Expenses", description:"The foundation of business deductibility. All deductible business expenses must be ordinary (common in your industry) and necessary (helpful and appropriate).", url:"https://www.law.cornell.edu/uscode/text/26/162" },
    { cite:"IRC §199A", label:"Qualified Business Income Deduction", description:"20% deduction on qualified pass-through income. S-Corp distributions may qualify. Subject to W-2 wage limitations at higher income levels.", url:"https://www.law.cornell.edu/uscode/text/26/199A" },
    { cite:"IRC §162(l)", label:"Health Insurance Deduction", description:"S-Corp owners who own >2% can deduct health insurance premiums — but only if the premium is included in W-2 wages first.", url:"https://www.law.cornell.edu/uscode/text/26/162" },
    { cite:"IRC §280A", label:"Home Office Deduction", description:"Deduction for the portion of your home used exclusively and regularly for business. Requires a dedicated space — a corner of a shared room does not qualify.", url:"https://www.law.cornell.edu/uscode/text/26/280A" },
    { cite:"IRC §404", label:"Retirement Plan Contributions", description:"S-Corp can deduct contributions to qualified retirement plans (SEP-IRA, Solo 401k, SIMPLE IRA) on behalf of W-2 employees including owners.", url:"https://www.law.cornell.edu/uscode/text/26/404" },
  ]},
  { group:"Federal — Payroll", items:[
    { cite:"IRC §3111", label:"Employer FICA Tax", description:"Employer must match the employee's Social Security (6.2%) and Medicare (1.45%) contributions. The S-Corp advantage: distributions above W-2 salary are not subject to FICA.", url:"https://www.law.cornell.edu/uscode/text/26/3111" },
    { cite:"IRC §3301–3311", label:"Federal Unemployment Tax (FUTA)", description:"0.6% net FUTA on the first $7,000 of each employee's wages after the state credit. Filed annually on Form 940.", url:"https://www.law.cornell.edu/uscode/text/26/3301" },
  ]},
  { group:"Washington State", items:[
    { cite:"RCW 82.04.290", label:"WA B&O Tax — Professional Services Rate", description:"Washington Business & Occupation tax rate of 1.5% on gross receipts for professional services, including market research.", url:"https://app.leg.wa.gov/rcw/default.aspx?cite=82.04.290" },
    { cite:"RCW 82.04.4451", label:"WA Small Business B&O Credit", description:"Businesses with gross receipts under $125,000/year may qualify for a B&O credit that eliminates the tax entirely. Credit phases out between $125K–$175K.", url:"https://app.leg.wa.gov/rcw/default.aspx?cite=82.04.4451" },
    { cite:"RCW 50.04", label:"WA Unemployment Insurance", description:"Washington State UI tax on wages. Rate varies by employer experience rating. Filed quarterly with the Employment Security Department.", url:"https://app.leg.wa.gov/rcw/default.aspx?cite=50.04" },
  ]},
  { group:"City of Seattle", items:[
    { cite:"SMC 5.45", label:"Seattle Business License Tax (B&O)", description:"Seattle's Business & Occupation tax applies to businesses with taxable gross receipts over $100,000 per year. Rate for professional services: ~0.415%.", url:"https://seattle.gov/license-and-tax-administration/business-license-tax/tax-rates-and-classifications" },
  ]},
];

function dueDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TaxClient({
  grossRevenueFromDB,
  expensesByCategory,
  taxRules,
  taxBrackets,
  deadlines,
  completions,
  members,
  entityType,
  dateFormat,
}: Props) {
  const [tab, setTab] = useState<Tab>("calculator");
  const [revenueOverride, setRevenueOverride] = useState<string>("");
  const [wagesOverride, setWagesOverride] = useState<string>("");
  const [w2OtherIncome, setW2OtherIncome] = useState<string>("0");
  const [completionState, setCompletionState] = useState<DeadlineCompletion[]>(completions);
  const [isPending, startTransition] = useTransition();

  const grossRevenue = revenueOverride !== "" ? parseFloat(revenueOverride) || 0 : grossRevenueFromDB;

  // Sum all active member salaries from DB — supports any number of members
  const defaultWages = members.reduce((sum, m) => sum + m.annual_salary, 0);
  const totalWages = wagesOverride !== "" ? parseFloat(wagesOverride) || 0 : defaultWages;

  const ficaRate      = taxRules["fica_employer_rate"]      ?? 0.0765;
  const futaRate      = taxRules["futa_rate"]               ?? 0.006;
  const futaWageBase  = taxRules["futa_wage_base"]          ?? 7000;
  const waSuiRate     = taxRules["wa_sui_rate"]             ?? 0.01;
  const waSuiWageBase = taxRules["wa_sui_wage_base"]        ?? 67600;
  const waBORate      = taxRules["wa_bo_professional_rate"] ?? 0.015;
  const seaBORate     = taxRules["seattle_bo_rate"]         ?? 0.00415;
  const stdDeduction  = taxRules["standard_deduction_mfj"]  ?? 30000;

  const ficaTax  = totalWages * ficaRate;
  const futaTax  = Math.min(totalWages, futaWageBase * 2) * futaRate;
  const waSuiTax = Math.min(totalWages, waSuiWageBase * 2) * waSuiRate;
  const totalEmployerTax = ficaTax + futaTax + waSuiTax;

  const payrollExpenses   = expensesByCategory.find(e => e.category === "Payroll")?.total ?? 0;
  const totalApproved     = expensesByCategory.reduce((s, e) => s + e.total, 0);
  const otherExpenses     = totalApproved - payrollExpenses;
  const scorpNetIncome    = grossRevenue - totalWages - totalEmployerTax - otherExpenses;

  // Only owners and officers receive K-1 distributions
  const distributionMembers = members.filter(m => m.role === "owner" || m.role === "officer");
  const memberDists = distributionMembers.map(m => ({
    ...m,
    dist: scorpNetIncome * (m.ownership_pct / 100),
  }));

  const waBOTax           = grossRevenue * waBORate;
  const seaBOTax          = grossRevenue * seaBORate;
  const otherW2           = parseFloat(w2OtherIncome) || 0;
  const householdIncome   = totalWages + Math.max(0, scorpNetIncome) + otherW2;
  const taxableIncome     = Math.max(0, householdIncome - stdDeduction);
  const incomeTax         = calcIncomeTax(taxableIncome, taxBrackets);
  const effectiveRate     = householdIncome > 0 ? incomeTax / householdIncome : 0;

  // QBI deduction (IRC §199A) — 20% of qualified business income
  // Subject to W-2 wage limitations; shown as an estimate only
  const qbiDeduction      = Math.max(0, scorpNetIncome) * 0.20;
  const taxableIncomeWithQBI = Math.max(0, householdIncome - stdDeduction - qbiDeduction);
  const incomeTaxWithQBI  = calcIncomeTax(taxableIncomeWithQBI, taxBrackets);

  // Safe distribution: gross K-1 minus each member's estimated tax reserve
  // Tax reserve = member's share of (income tax + WA B&O + Seattle B&O)
  const totalStateTax  = waBOTax + seaBOTax;
  const totalTaxBurden = incomeTaxWithQBI + totalStateTax;
  const memberDistsWithReserves = memberDists.map(m => ({
    ...m,
    reserve: totalTaxBurden * (m.ownership_pct / 100),
    safeDist: Math.max(0, m.dist - totalTaxBurden * (m.ownership_pct / 100)),
  }));

  const allInstances = generateDeadlines(deadlines, completionState, 2026);

  const toggleComplete = (deadlineId: number, period: string) => {
    const exists = completionState.some(c => c.deadline_id === deadlineId && c.period === period);
    if (exists) {
      setCompletionState(prev => prev.filter(c => !(c.deadline_id === deadlineId && c.period === period)));
    } else {
      setCompletionState(prev => [...prev, { deadline_id: deadlineId, period }]);
    }
    startTransition(async () => {
      await fetch("/api/tax/completions", {
        method: exists ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadlineId, period, taxYear: 2026, businessId: 1 }),
      });
    });
  };

  const tabLabels: Record<Tab, string> = {
    calculator: "Calculator",
    calendar: "Filing Calendar",
    deductions: "Deductions",
    taxcode: "Tax Code",
  };

  return (
    <div style={{ fontFamily: C.sans, color: C.textPri }}>
      {/* Tab bar */}
      <div style={{ display:"flex", gap:4, marginBottom:28, borderBottom:`1px solid ${C.border}`, paddingBottom:12 }}>
        {(["calculator","calendar","deductions","taxcode"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab===t ? C.accent+"22" : "transparent",
            border: `1px solid ${tab===t ? C.accent : "transparent"}`,
            borderRadius:8, padding:"7px 18px",
            color: tab===t ? C.accent : C.textDim,
            fontSize:13, fontFamily:C.sans, cursor:"pointer",
            fontWeight: tab===t ? 600 : 400, transition:"all 0.15s",
          }}>
            {tabLabels[t]}
          </button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:11, color:C.textDim, fontFamily:C.mono, alignSelf:"center" }}>
          Guidance only — consult a licensed CPA for filing decisions
        </div>
      </div>

      {/* ── CALCULATOR ── */}
      {tab === "calculator" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:28 }}>

            {/* Gross Revenue */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Gross Revenue</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="number"
                  value={revenueOverride !== "" ? revenueOverride : grossRevenueFromDB}
                  onChange={e => setRevenueOverride(e.target.value)}
                  style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.textPri, fontSize:15, fontFamily:C.mono, outline:"none" }}
                />
                {revenueOverride !== "" && (
                  <button onClick={() => setRevenueOverride("")} style={{ background:C.accent+"22", border:`1px solid ${C.accent}44`, borderRadius:6, padding:"6px 10px", color:C.accent, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>
                    ↺ Revert
                  </button>
                )}
              </div>
              <div style={{ fontSize:11, color:C.textDim, marginTop:6 }}>
                {revenueOverride !== "" ? `Income ledger total: $${fmt(grossRevenueFromDB)}` : "← from income ledger (approved records)"}
              </div>
            </div>

            {/* Total W-2 Wages */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Total W-2 Wages</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="number"
                  value={wagesOverride !== "" ? wagesOverride : defaultWages}
                  onChange={e => setWagesOverride(e.target.value)}
                  style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.textPri, fontSize:15, fontFamily:C.mono, outline:"none" }}
                />
                {wagesOverride !== "" && (
                  <button onClick={() => setWagesOverride("")} style={{ background:C.accent+"22", border:`1px solid ${C.accent}44`, borderRadius:6, padding:"6px 10px", color:C.accent, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>
                    ↺ Revert
                  </button>
                )}
              </div>
              <div style={{ fontSize:11, color:C.textDim, marginTop:6 }}>
                Default: {members.map(m => `${m.name} $${m.annual_salary.toLocaleString()}`).join(" + ")} (connect Gusto for live data)
              </div>
            </div>

            {/* Other W-2 Income */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
              <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Other Household W-2 Income</div>
              <input type="number" value={w2OtherIncome} onChange={e => setW2OtherIncome(e.target.value)}
                style={{ width:"100%", boxSizing:"border-box", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.textPri, fontSize:15, fontFamily:C.mono, outline:"none" }}
              />
              <div style={{ fontSize:11, color:C.textDim, marginTop:6 }}>Partner outside W-2 income — for income tax estimate only</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
            {/* Waterfall */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:24 }}>
              <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:20 }}>S-Corp Income Waterfall</div>
              {[
                { label:"Gross Revenue",         value:grossRevenue,     color:C.green, sign:"" },
                { label:"Total W-2 Wages",        value:totalWages,       color:C.red,   sign:"−" },
                { label:"Employer Payroll Taxes", value:totalEmployerTax, color:C.red,   sign:"−" },
                { label:"Other Expenses",         value:otherExpenses,    color:C.red,   sign:"−" },
              ].map(({ label, value, color, sign }) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.textSec }}>
                    {sign && <span style={{ color, marginRight:6 }}>{sign}</span>}
                    {label}
                  </span>
                  <span style={{ fontSize:14, fontFamily:C.mono, color }}>${fmt(value)}</span>
                </div>
              ))}
              <div style={{ height:2, background:C.border, margin:"8px 0" }} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0" }}>
                <span style={{ fontSize:14, color:C.textPri, fontWeight:700 }}>S-Corp Net Income</span>
                <span style={{ fontSize:18, fontFamily:C.mono, fontWeight:700, color:scorpNetIncome >= 0 ? C.green : C.gold }}>
                  ${fmt(scorpNetIncome)}
                </span>
              </div>
              {scorpNetIncome < 0 && (
                <div style={{ background:C.gold+"18", border:`1px solid ${C.gold}44`, borderRadius:8, padding:"10px 14px", marginTop:8, fontSize:12, color:C.gold, lineHeight:1.6 }}>
                  ⚠ At current revenue, wages and expenses exceed S-Corp net income. Common in early-stage and growth phases — the S-Corp advantage grows as revenue exceeds the salary base.
                </div>
              )}

              {scorpNetIncome > 0 && (
                <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>K-1 Distributions (not subject to SE tax)</div>
                  {memberDists.map(m => (
                    <div key={m.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:13, color:C.textSec }}>{m.name} ({m.ownership_pct}%)</span>
                      <span style={{ fontSize:14, fontFamily:C.mono, color:C.purple }}>${fmt(m.dist)}</span>
                    </div>
                  ))}

                  {/* Safe distribution after tax reserves */}
                  <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>Safe Take-Home After Tax Reserves</div>
                    <div style={{ fontSize:11, color:C.textDim, lineHeight:1.6, marginBottom:12 }}>
                      Gross K-1 minus each member&apos;s estimated share of income tax, WA B&O, and Seattle B&O.
                    </div>
                    {memberDistsWithReserves.map(m => (
                      <div key={m.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", marginBottom:8 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.textPri, marginBottom:8 }}>
                          {m.name}
                          <span style={{ fontSize:11, color:C.textDim, marginLeft:6 }}>({m.ownership_pct}% — {m.role})</span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
                          <span style={{ fontSize:11, color:C.textDim }}>Gross K-1</span>
                          <span style={{ fontSize:12, fontFamily:C.mono, color:C.purple }}>${fmt(m.dist)}</span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
                          <span style={{ fontSize:11, color:C.textDim }}>Est. tax reserve</span>
                          <span style={{ fontSize:12, fontFamily:C.mono, color:C.red }}>−${fmt(m.reserve)}</span>
                        </div>
                        <div style={{ height:1, background:C.border, margin:"6px 0" }} />
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
                          <span style={{ fontSize:12, fontWeight:600, color:C.textPri }}>Safe take-home</span>
                          <span style={{ fontSize:13, fontFamily:C.mono, fontWeight:700, color:m.safeDist > 0 ? C.green : C.gold }}>${fmt(m.safeDist)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Employer payroll taxes */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Employer Payroll Taxes</div>
                {[
                  { label:`Employer FICA (${fmtPct(ficaRate)})`, value:ficaTax },
                  { label:`FUTA (${fmtPct(futaRate)} up to $${futaWageBase.toLocaleString()}/ee)`, value:futaTax },
                  { label:`WA SUI (~${fmtPct(waSuiRate)} up to $${waSuiWageBase.toLocaleString()}/ee)`, value:waSuiTax },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.textSec }}>{label}</span>
                    <span style={{ fontSize:13, fontFamily:C.mono, color:C.textPri }}>${fmt(value)}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0" }}>
                  <span style={{ fontSize:13, color:C.textPri, fontWeight:600 }}>Total Employer Tax</span>
                  <span style={{ fontSize:14, fontFamily:C.mono, color:C.red, fontWeight:700 }}>${fmt(totalEmployerTax)}</span>
                </div>
              </div>

              {/* B&O */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>WA & Seattle B&O Taxes</div>
                {[
                  { label:`WA B&O (${fmtPct(waBORate)} × revenue)`, value:waBOTax, note:"Annual est. — filed monthly" },
                  { label:`Seattle B&O (${fmtPct(seaBORate)} × revenue)`, value:seaBOTax, note:"Annual est. — filed monthly" },
                ].map(({ label, value, note }) => (
                  <div key={label} style={{ padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:12, color:C.textSec }}>{label}</span>
                      <span style={{ fontSize:13, fontFamily:C.mono, color:C.textPri }}>${fmt(value)}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{note}</div>
                  </div>
                ))}
              </div>

              {/* Income tax estimate */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:11, color:C.textDim, fontFamily:C.mono, letterSpacing:1, textTransform:"uppercase", marginBottom:14 }}>Federal Income Tax Estimate</div>
                {[
                  { label:"W-2 Wages",          value:totalWages },
                  { label:"S-Corp Pass-through", value:Math.max(0, scorpNetIncome) },
                  { label:"Other W-2 Income",    value:otherW2 },
                  { label:"− Standard Deduction", value:-stdDeduction },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.textSec }}>{label}</span>
                    <span style={{ fontSize:12, fontFamily:C.mono, color:value < 0 ? C.red : C.textPri }}>${fmt(Math.abs(value))}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.textSec }}>Taxable Income</span>
                  <span style={{ fontSize:13, fontFamily:C.mono, color:C.textPri }}>${fmt(taxableIncome)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0" }}>
                  <span style={{ fontSize:13, color:C.textPri, fontWeight:600 }}>Est. Income Tax</span>
                  <span style={{ fontSize:14, fontFamily:C.mono, color:C.accent, fontWeight:700 }}>${fmt(incomeTax)}</span>
                </div>
                <div style={{ fontSize:11, color:C.textDim, marginTop:4 }}>
                  Effective rate: {fmtPct(effectiveRate)} — Partner&apos;s W-2 withholding may cover this. Verify at filing with your CPA.
                </div>
                {/* QBI deduction callout */}
                <div style={{ background:C.green+"12", border:`1px solid ${C.green}22`, borderRadius:6, padding:"8px 12px", marginTop:10 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:C.green, marginBottom:4 }}>
                    💡 IRC §199A QBI Deduction may apply
                  </div>
                  <div style={{ fontSize:11, color:C.textDim, lineHeight:1.5 }}>
                    S-Corp pass-through income may qualify for a 20% deduction on qualified business income (~${fmt(qbiDeduction)} est.), reducing taxable income to ~${fmt(taxableIncomeWithQBI)} and income tax to ~${fmt(incomeTaxWithQBI)}. Subject to W-2 wage limitations at higher incomes — verify with your CPA.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FILING CALENDAR ── */}
      {tab === "calendar" && (
        <div>
          {(["federal","employment","wa_state","seattle"] as const).map(jurisdiction => {
            const items = allInstances.filter(i => i.deadline.jurisdiction === jurisdiction);
            if (items.length === 0) return null;
            const labels: Record<string, string> = { federal:"Federal", employment:"Employment", wa_state:"WA State", seattle:"Seattle" };
            return (
              <div key={jurisdiction} style={{ marginBottom:32 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <div style={{ width:3, height:18, background:C.accent, borderRadius:2 }} />
                  <span style={{ fontSize:11, fontFamily:C.mono, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>{labels[jurisdiction]}</span>
                  <div style={{ flex:1, height:1, background:C.border }} />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {items.map(instance => {
                    const urgencyColor =
                      instance.isComplete ? C.textDim :
                      instance.daysUntil < 0 ? C.red :
                      instance.daysUntil <= 14 ? C.red :
                      instance.daysUntil <= 30 ? C.gold : C.green;
                    return (
                      <div key={`${instance.deadline.id}-${instance.period}`} style={{
                        background:C.surface, border:`1px solid ${instance.isComplete ? C.border : urgencyColor+"33"}`,
                        borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"center", gap:16,
                        opacity: instance.isComplete ? 0.6 : 1,
                      }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:urgencyColor, flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                            <span style={{ fontSize:13, fontWeight:600, color:C.textPri, textDecoration:instance.isComplete ? "line-through" : "none" }}>
                              {instance.deadline.form_name}
                            </span>
                            <span style={{ fontSize:11, color:C.textDim, fontFamily:C.mono }}>{instance.period}</span>
                          </div>
                          {instance.deadline.description && (
                            <div style={{ fontSize:11, color:C.textDim, lineHeight:1.5 }}>
                              {instance.deadline.description.slice(0, 100)}{instance.deadline.description.length > 100 ? "…" : ""}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:12, fontFamily:C.mono, color:urgencyColor, fontWeight:600 }}>
                            {instance.isComplete ? "Done" : instance.daysUntil < 0 ? `${Math.abs(instance.daysUntil)}d overdue` : instance.daysUntil === 0 ? "Due today" : `${instance.daysUntil}d`}
                          </div>
                          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>
                            {formatDate(dueDateStr(instance.dueDate), dateFormat)}
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                          {instance.deadline.source_url && (
                            <a href={instance.deadline.source_url} target="_blank" rel="noopener noreferrer" style={{
                              background:C.accent+"18", border:`1px solid ${C.accent}33`,
                              borderRadius:6, padding:"5px 10px", color:C.accent,
                              fontSize:11, textDecoration:"none", whiteSpace:"nowrap",
                            }}>
                              ↗ Source
                            </a>
                          )}
                          <button onClick={() => toggleComplete(instance.deadline.id, instance.period)} disabled={isPending} style={{
                            background: instance.isComplete ? C.border : C.green+"18",
                            border: `1px solid ${instance.isComplete ? C.border : C.green+"44"}`,
                            borderRadius:6, padding:"5px 10px",
                            color: instance.isComplete ? C.textDim : C.green,
                            fontSize:11, cursor:"pointer", whiteSpace:"nowrap",
                          }}>
                            {instance.isComplete ? "↩ Undo" : "✓ Done"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DEDUCTIONS ── */}
      {tab === "deductions" && (
        <div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 18px", marginBottom:24, fontSize:12, color:C.textSec, lineHeight:1.6 }}>
            Cross-referencing your approved expense categories against known S-Corp deductions. Categories with no expenses logged are flagged as potential opportunities.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {SCORP_DEDUCTIONS.map(deduction => {
              const amount = expensesByCategory.find(e => e.category === deduction.category)?.total ?? 0;
              const hasCaptured = amount > 0;
              return (
                <div key={deduction.category} style={{ background:C.surface, border:`1px solid ${hasCaptured ? C.green+"33" : C.gold+"33"}`, borderRadius:10, padding:18 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:C.textPri, marginBottom:2 }}>{deduction.label}</div>
                      <div style={{ fontSize:11, fontFamily:C.mono, color:C.textDim }}>{deduction.irc}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                      {hasCaptured ? (
                        <div>
                          <div style={{ fontSize:14, fontFamily:C.mono, color:C.green, fontWeight:700 }}>${fmt(amount)}</div>
                          <div style={{ fontSize:10, color:C.green }}>captured</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize:12, color:C.gold }}>⚠ $0 logged</div>
                          <div style={{ fontSize:10, color:C.textDim }}>opportunity?</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:C.textDim, lineHeight:1.6, marginBottom:deduction.tip ? 8 : 0 }}>{deduction.description}</div>
                  {deduction.tip && (
                    <div style={{ background:C.accent+"12", border:`1px solid ${C.accent}22`, borderRadius:6, padding:"6px 10px", fontSize:11, color:C.accent, lineHeight:1.5 }}>
                      💡 {deduction.tip}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAX CODE ── */}
      {tab === "taxcode" && (
        <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
          {TAX_CODE_REFS.map(group => (
            <div key={group.group}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:3, height:18, background:C.accent, borderRadius:2 }} />
                <span style={{ fontSize:11, fontFamily:C.mono, color:C.accent, letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>{group.group}</span>
                <div style={{ flex:1, height:1, background:C.border }} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {group.items.map(item => (
                  <div key={item.cite} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px", display:"flex", alignItems:"flex-start", gap:16 }}>
                    <div style={{ background:C.accent+"18", border:`1px solid ${C.accent}33`, borderRadius:6, padding:"4px 10px", fontSize:11, fontFamily:C.mono, color:C.accent, whiteSpace:"nowrap", flexShrink:0 }}>
                      {item.cite}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.textPri, marginBottom:4 }}>{item.label}</div>
                      <div style={{ fontSize:12, color:C.textDim, lineHeight:1.6 }}>{item.description}</div>
                    </div>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ background:C.accent+"18", border:`1px solid ${C.accent}33`, borderRadius:6, padding:"5px 10px", color:C.accent, fontSize:11, textDecoration:"none", whiteSpace:"nowrap", flexShrink:0 }}>
                      ↗ Read
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
