import db from "@/lib/db";
import SettingsClient from "./SettingsClient";

const BUSINESS_ID = 1;

export default async function SettingsPage() {
  const rows = db
    .prepare(`SELECT key, value FROM settings WHERE business_id = ?`)
    .all(BUSINESS_ID) as { key: string; value: string }[];

  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#e8edf5]" style={{ fontFamily: "'Outfit','DM Sans',sans-serif" }}>
          Settings
        </h1>
        <p className="text-sm text-[#8896b0] mt-1">
          App-wide preferences — changes apply across all pages immediately
        </p>
      </div>
      <SettingsClient settings={settings} />
    </main>
  );
}
