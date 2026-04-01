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

    const response = await plaidClient.accountsBalanceGet({
      access_token: connection.access_token,
    });

    const depositoryAccounts = response.data.accounts.filter(
      a => a.type === "depository"
    );

    const totalBalance = depositoryAccounts.reduce((sum, account) => {
      const balance = account.balances.available ?? account.balances.current ?? 0;
      return sum + balance;
    }, 0);

    const now = new Date().toISOString();

    sqlite.prepare(`
      UPDATE settings SET value = ?, updated_at = ?
      WHERE business_id = 1 AND key = 'current_cash_manual'
    `).run(totalBalance.toString(), now);

    sqlite.prepare(`
      UPDATE settings SET value = ?, updated_at = ?
      WHERE business_id = 1 AND key = 'current_cash_cached_at'
    `).run(now, now);

    return NextResponse.json({
      balance: totalBalance,
      cached_at: now,
      accounts: response.data.accounts.map(a => ({
        account_id: a.account_id,
        name:       a.name,
        available:  a.balances.available,
        current:    a.balances.current,
        currency:   a.balances.iso_currency_code,
      })),
    });

  } catch (error) {
    console.error("Plaid balance error:", error);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
