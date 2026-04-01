import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import sqlite from "@/lib/db";

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET":    process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export async function refreshPlaidBalance(): Promise<void> {
  const connection = sqlite.prepare(
    `SELECT access_token FROM plaid_connections WHERE business_id = 1 LIMIT 1`
  ).get() as { access_token: string } | undefined;

  if (!connection) return;

  const response = await plaidClient.accountsBalanceGet({
    access_token: connection.access_token,
  });

  const totalBalance = response.data.accounts
    .filter(a => a.type === "depository")
    .reduce((sum, a) => sum + (a.balances.available ?? a.balances.current ?? 0), 0);

  const now = new Date().toISOString();

  sqlite.prepare(
    `UPDATE settings SET value = ?, updated_at = ? WHERE business_id = 1 AND key = 'current_cash_manual'`
  ).run(totalBalance.toString(), now);

  sqlite.prepare(
    `UPDATE settings SET value = ?, updated_at = ? WHERE business_id = 1 AND key = 'current_cash_cached_at'`
  ).run(now, now);
}