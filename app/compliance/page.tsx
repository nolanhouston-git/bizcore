import db from "@/lib/db";
import ComplianceClient from "./ComplianceClient";

const BUSINESS_ID = 1;

function getComplianceData() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  // Build each obligation's next due date as YYYY-MM-DD for comparison
  // Then left join completions for current year to determine status
  const obligations = db.prepare(`
    SELECT
      o.id,
      o.name,
      o.category,
      o.jurisdiction,
      o.recurrence,
      o.due_month,
      o.due_day,
      o.source_url,
      o.notes,
      c.period_label,
      c.completed_at,
      c.notes AS completion_notes
    FROM compliance_obligations o
    LEFT JOIN compliance_completions c
      ON c.obligation_id = o.id
      AND c.business_id = o.business_id
      AND c.period_label = ?
    WHERE o.business_id = ?
      AND o.active = 1
    ORDER BY o.due_month, o.due_day
  `).all(String(currentYear), BUSINESS_ID) as any[];

  // Compute status for each obligation
  const withStatus = obligations.map((row) => {
    const dueDateStr = `${currentYear}-${String(row.due_month).padStart(2, "0")}-${String(row.due_day).padStart(2, "0")}`;
    const dueDate = new Date(dueDateStr);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status: "compliant" | "overdue" | "due_soon" | "upcoming";
    if (row.completed_at) {
      status = "compliant";
    } else if (daysUntilDue < 0) {
      status = "overdue";
    } else if (daysUntilDue <= 30) {
      status = "due_soon";
    } else {
      status = "upcoming";
    }

    return {
      ...row,
      due_date: dueDateStr,
      days_until_due: daysUntilDue,
      status,
    };
  });

  // Pull gap analysis from settings
  const gapResult = db.prepare(`
    SELECT value FROM settings WHERE business_id = ? AND key = 'compliance_gap_result'
  `).get(BUSINESS_ID) as { value: string } | undefined;

  const gapRanAt = db.prepare(`
    SELECT value FROM settings WHERE business_id = ? AND key = 'compliance_gap_ran_at'
  `).get(BUSINESS_ID) as { value: string } | undefined;

  // Staleness: older than 30 days
  let gapIsStale = false;
  if (gapRanAt?.value) {
    const ranAt = new Date(gapRanAt.value);
    const daysSinceRun = Math.ceil((today.getTime() - ranAt.getTime()) / (1000 * 60 * 60 * 24));
    gapIsStale = daysSinceRun > 30;
  }

  const dateFormatSetting = db.prepare(`
    SELECT value FROM settings WHERE business_id = ? AND key = 'date_format'
  `).get(BUSINESS_ID) as { value: string } | undefined;

  // Summary counts
  const summary = {
    overdue: withStatus.filter((o) => o.status === "overdue").length,
    due_soon: withStatus.filter((o) => o.status === "due_soon").length,
    compliant: withStatus.filter((o) => o.status === "compliant").length,
    upcoming: withStatus.filter((o) => o.status === "upcoming").length,
  };

  return {
    obligations: withStatus,
    summary,
    currentYear,
    gapResult: gapResult?.value ?? null,
    gapRanAt: gapRanAt?.value ?? null,
    gapIsStale,
    dateFormat: dateFormatSetting?.value ?? "Mon DD, YYYY",
  };
}

export default function CompliancePage() {
  const data = getComplianceData();
  return (
    <div className="p-10">
      <ComplianceClient {...data} />
    </div>
  );
}