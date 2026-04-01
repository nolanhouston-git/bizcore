import { NextResponse } from "next/server";
import sqlite from "@/lib/db";

export async function POST() {
  sqlite.prepare("DELETE FROM plaid_connections WHERE business_id = 1").run();
  return NextResponse.json({ success: true });
}