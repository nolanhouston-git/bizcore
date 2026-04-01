"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { uploadFile, buildKey } from "@/lib/r2";

const BUSINESS_ID = 1;

export async function markObligationComplete(
  obligationId: number,
  periodLabel: string,
  notes: string,
  formData: FormData
): Promise<{ error: string | null }> {
  try {
    // Insert completion record
    const result = db.prepare(`
      INSERT INTO compliance_completions
        (business_id, obligation_id, period_label, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(business_id, obligation_id, period_label) DO NOTHING
    `).run(BUSINESS_ID, obligationId, periodLabel, notes || null);

    const completionId = result.lastInsertRowid as number;

    // Handle optional file upload
    const file = formData.get("document") as File | null;
    if (file && file.size > 0 && completionId) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const key = buildKey("compliance", completionId, file.name);

      const { error: uploadError } = await uploadFile(key, buffer, file.type);
      if (uploadError) {
        return { error: "Marked complete but file upload failed. Try uploading again." };
      }

      // Save document metadata
      db.prepare(`
        INSERT INTO documents
          (business_id, r2_key, file_name, file_size, mime_type, category, linked_to, linked_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        BUSINESS_ID,
        key,
        file.name,
        file.size,
        file.type,
        "Compliance",
        "compliance_completion",
        completionId
      );
    }

    revalidatePath("/compliance");
    return { error: null };
  } catch (err) {
    console.error("markObligationComplete error:", err);
    return { error: "Failed to mark complete. Please try again." };
  }
}
