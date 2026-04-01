import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import sqlite from "@/lib/db";

export async function GET() {
  try {
    const connection = sqlite.prepare(`
      SELECT access_token FROM plaid_connections WHERE business_id = 1 LIMIT 1
    `).get() as { access_token: string } | undefined;

    if (!connection) {
      return NextResponse.json({ error: "No bank connected" }, { status: 400 });
    }

    const response = await plaidClient.accountsGet({
      access_token: connection.access_token,
    });

    const accounts = response.data.accounts.map(a => ({
      account_id:    a.account_id,
      name:          a.name,
      official_name: a.official_name,
      type:          a.type,
      subtype:       a.subtype,
      balance:       a.balances.current,
      currency:      a.balances.iso_currency_code,
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Plaid accounts error:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}