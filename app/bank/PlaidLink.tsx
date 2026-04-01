"use client";

import { useEffect, useCallback, useState } from "react";

type Props = {
  onSuccess: () => void;
};

export default function PlaidLink({ onSuccess }: Props) {
  const [linkToken, setLinkToken]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Get a link token from our server when component mounts
  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.link_token) setLinkToken(data.link_token);
        else setError("Failed to initialize Plaid");
      })
      .catch(() => setError("Failed to initialize Plaid"));
  }, []);

  const openPlaidLink = useCallback(() => {
    if (!linkToken) return;
    setLoading(true);

    // Load Plaid Link script dynamically
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.onload = () => {
      // @ts-ignore — Plaid adds itself to window
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (public_token: string, metadata: any) => {
          try {
            const res = await fetch("/api/plaid/exchange-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_token,
                institution_name: metadata.institution?.name,
                institution_id:   metadata.institution?.institution_id,
              }),
            });

            if (res.ok) {
              onSuccess();
            } else {
              setError("Failed to connect bank account");
            }
          } catch {
            setError("Failed to connect bank account");
          }
          setLoading(false);
        },
        onExit: () => {
          setLoading(false);
        },
      });
      handler.open();
    };
    document.head.appendChild(script);
  }, [linkToken, onSuccess]);

  if (error) {
    return (
      <div className="text-[#f87171] text-sm font-mono">{error}</div>
    );
  }

  return (
    <button
      onClick={openPlaidLink}
      disabled={!linkToken || loading}
      className="bg-gradient-to-r from-[#4f8ef7] to-[#6366f1] text-white rounded-lg px-6 py-3 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Connecting…" : !linkToken ? "Initializing…" : "⊕ Connect Bank Account"}
    </button>
  );
}