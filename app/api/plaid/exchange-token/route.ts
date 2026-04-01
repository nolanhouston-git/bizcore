import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import sqlite from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { public_token, institution_name, institution_id } = await request.json();

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = response.data.access_token;
    const itemId      = response.data.item_id;

    // Store access token securely in .env.local
    const envPath    = path.join(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");

    // Replace or append PLAID_ACCESS_TOKEN
    const updated = envContent.includes("PLAID_ACCESS_TOKEN=")
      ? envContent.replace(/PLAID_ACCESS_TOKEN=.*/,  `PLAID_ACCESS_TOKEN=${accessToken}`)
      : envContent + `\nPLAID_ACCESS_TOKEN=${accessToken}`;

    fs.writeFileSync(envPath, updated);

    // Store connection metadata in database
    // Remove any existing connection first
    sqlite.prepare("DELETE FROM plaid_connections WHERE business_id = 1").run();

    sqlite.prepare(`
      INSERT INTO plaid_connections (business_id, access_token, item_id, institution_name, institution_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(1, accessToken, itemId, institution_name || null, institution_id || null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Plaid exchange token error:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}