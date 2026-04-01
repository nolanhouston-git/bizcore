"use client";

import { useState } from "react";

type Props = {
  onSync: () => void;
};

export default function SyncButton({ onSync }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult]   = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    try {
      const res  = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setResult(`✓ Imported ${data.imported} new transaction${data.imported === 1 ? "" : "s"}`);
        onSync();
      } else {
        setResult("⚠ Sync failed — check console");
      }
    } catch {
      setResult("⚠ Sync failed");
    }

    setSyncing(false);
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="bg-[#1e3a6e] border border-[#4f8ef7]/30 text-[#4f8ef7] rounded-lg px-5 py-2 text-sm font-bold hover:bg-[#4f8ef7]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {syncing ? "Syncing…" : "↻ Sync Now"}
      </button>
      {result && (
        <span className={`text-sm font-mono ${result.startsWith("✓") ? "text-[#34d399]" : "text-[#e8b84b]"}`}>
          {result}
        </span>
      )}
    </div>
  );
}