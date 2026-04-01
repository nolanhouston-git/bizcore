import { getDashboardData } from "@/lib/dashboardData";
import { DEFAULT_LAYOUT, LayoutItem } from "@/lib/widgets";
import DashboardClient from "@/app/dashboard/DashboardClient";
import db from "@/lib/db";

const BUSINESS_ID = 1;

function getSetting(key: string, fallback: string): string {
  const row = db.prepare(
    `SELECT value FROM settings WHERE business_id = ? AND key = ?`
  ).get(BUSINESS_ID, key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

function getLayout(): LayoutItem[] {
  const saved = getSetting("dashboard_layout", "");
  if (!saved) return DEFAULT_LAYOUT;
  try {
    const parsed = JSON.parse(saved);
    // Merge saved layout with registry — ensures new widgets added
    // after a layout was saved still appear (as hidden)
    const savedIds = new Set(parsed.map((l: LayoutItem) => l.i));
    const missing  = DEFAULT_LAYOUT.filter(l => !savedIds.has(l.i))
                       .map(l => ({ ...l, visible: false }));
    return [...parsed, ...missing];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export default async function HomePage() {
  const [data, layout, dateFormat] = await Promise.all([
    getDashboardData(),
    Promise.resolve(getLayout()),
    Promise.resolve(getSetting("date_format", "Mon DD, YYYY")),
  ]);

  // Container width: max-w-7xl = 1280px, minus 48px padding = 1232px
  const containerWidth = 1232;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <DashboardClient
        data={data}
        initialLayout={layout}
        dateFormat={dateFormat}
        containerWidth={containerWidth}
      />
    </main>
  );
}
