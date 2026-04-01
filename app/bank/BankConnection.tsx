"use client";

import { useState } from "react";
import PlaidLink from "./PlaidLink";
import SyncButton from "./SyncButton";
import { formatDate, formatDateTime, type DateFormatKey } from "@/lib/dateFormat";

type Props = {
  connected: boolean;
  institutionName: string | null;
  connectedAt: string | null;
  lastSynced: string | null;
  dateFormat: DateFormatKey;
};

export default function BankConnection({ connected, institutionName, connectedAt, lastSynced, dateFormat }: Props) {
  const [isConnected, setIsConnected] = useState(connected);

  async function handleDisconnect() {
    await fetch("/api/plaid/disconnect", { method: "POST" });
    setIsConnected(false);
    window.location.reload();
  }

  return (
    <div className={`bg-[#0f1420] border rounded-2xl p-8 mb-8 ${isConnected ? "border-[#34d399]/30" : "border-[#1e2535]"}`}>
      <div className="flex items-start justify-between flex-wrap gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-[#34d399]" : "bg-[#4a566e]"}`} />
            <span className="font-semibold text-base">
              {isConnected
                ? `Connected — ${institutionName || "Bank Account"}`
                : "No bank connected"}
            </span>
          </div>
          {isConnected && (
            <div className="space-y-1">
              {connectedAt && (
                <p className="text-xs font-mono text-[#4a566e]">
                  Connected: {formatDate(connectedAt.slice(0, 10), dateFormat)}
                </p>
              )}
              {lastSynced && (
                <p className="text-xs font-mono text-[#4a566e]">
                  Last synced: {formatDateTime(lastSynced, dateFormat)}
                </p>
              )}
            </div>
          )}
          {!isConnected && (
            <p className="text-sm text-[#8896b0] mt-1 max-w-md">
              BizCore uses Plaid to securely connect your account. Your credentials never touch our server.
            </p>
          )}
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          {isConnected ? (
            <>
              <SyncButton onSync={() => window.location.reload()} />
              <button
                onClick={handleDisconnect}
                className="bg-[#2d0a0a] border border-[#f87171]/30 text-[#f87171] rounded-lg px-4 py-2 text-sm hover:bg-[#f87171]/20 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <PlaidLink onSuccess={() => { setIsConnected(true); window.location.reload(); }} />
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="mt-6 flex gap-2 flex-wrap">
          {["Bank-grade encryption", "Read-only access", "No stored credentials"].map(tag => (
            <span key={tag} className="bg-[#042f2e] text-[#2dd4bf] border border-[#2dd4bf]/30 rounded px-3 py-1 text-xs font-mono">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}