import db from "@/lib/db";

export async function POST() {
  try {
    // 1. Query business profile
    const business = db.prepare(
      `SELECT name, structure, city, state, county, entity_type
       FROM businesses WHERE id = 1`
    ).get() as { name: string; structure: string; city: string; state: string; county: string; entity_type: string } | undefined;

    // 2. Query active compliance obligations
    const obligations = db.prepare(
      `SELECT name, jurisdiction, category
       FROM compliance_obligations
       WHERE business_id = 1 AND active = 1`
    ).all() as { name: string; jurisdiction: string | null; category: string | null }[];

    const obligationList = obligations.length > 0
      ? obligations.map(o => `- ${o.name} (${o.jurisdiction ?? "—"}, ${o.category ?? "—"})`).join("\n")
      : "- No obligations on file";

    const b = business;
    const prompt =
      `You are a compliance advisor reviewing the obligations register for ${b?.name ?? "this business"}, a ${b?.structure ?? "business"} based in ${b?.city ?? ""}, ${b?.state ?? ""} (${b?.county ?? ""}).

Current obligations on file:
${obligationList}

Please review this list and identify any compliance obligations that appear to be missing for this type of business in this location. Consider:
- Federal obligations (tax filings, employment taxes, etc.)
- Washington State obligations (B&O tax, UBI license, SOS filings, etc.)
- Seattle city obligations (business license, B&O tax, etc.)
- King County obligations
- Industry-specific obligations for market research / professional services

For each missing item you identify, briefly explain what it is and why it applies. If the current list looks complete, say so.
Be concise and practical — this is for a small business owner.`;

    // 3. Call Anthropic API with streaming
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok || !anthropicRes.body) {
      const errText = await anthropicRes.text();
      return new Response(`Anthropic API error: ${errText}`, { status: 500 });
    }

    // 4. Stream plain text back, accumulating for DB save
    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                typeof parsed.delta.text === "string"
              ) {
                fullText += parsed.delta.text;
                controller.enqueue(encoder.encode(parsed.delta.text));
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        // 5. Save result to settings after streaming completes
        const saveStmt = db.prepare(
          `INSERT OR REPLACE INTO settings (business_id, key, value, updated_at)
           VALUES (1, ?, ?, datetime('now'))`
        );
        saveStmt.run("compliance_gap_result", fullText);
        saveStmt.run("compliance_gap_ran_at", new Date().toISOString());

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Gap analysis error:", err);
    return new Response(
      err instanceof Error ? err.message : "Internal server error",
      { status: 500 }
    );
  }
}
