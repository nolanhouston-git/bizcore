// Shared date formatting utility — used across the whole app.
// Change PAYROLL_COLORS in gusto for color theming;
// change this function's format map for date display.
//
// Accepts a date string (YYYY-MM-DD or ISO) and a format key from settings.
// Always runs on the client after hydration — never call during SSR render.

export type DateFormatKey = "Mon DD, YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";

export function formatDate(dateStr: string, fmt: DateFormatKey | string): string {
  if (!dateStr) return "";

  // Parse safely — append T12:00:00 to avoid UTC midnight shifting the day
  const normalized = dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr;
  const d = new Date(normalized);

  if (isNaN(d.getTime())) return dateStr; // fallback: return raw string

  const year  = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const day   = d.getDate();

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mm  = String(month + 1).padStart(2, "0");
  const dd  = String(day).padStart(2, "0");
  const mon = MONTHS[month];

  switch (fmt) {
    case "Mon DD, YYYY": return `${mon} ${dd}, ${year}`;
    case "MM/DD/YYYY":   return `${mm}/${dd}/${year}`;
    case "YYYY-MM-DD":   return `${year}-${mm}-${dd}`;
    case "DD/MM/YYYY":   return `${dd}/${mm}/${year}`;
    default:             return `${mon} ${dd}, ${year}`;
  }
}

// Format a full ISO datetime string (for "last synced" type labels)
export function formatDateTime(isoStr: string, fmt: DateFormatKey | string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;

  const datePart = formatDate(isoStr.slice(0, 10), fmt);
  const hours   = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm    = hours >= 12 ? "PM" : "AM";
  const h12     = hours % 12 || 12;

  return `${datePart} ${h12}:${minutes} ${ampm}`;
}
