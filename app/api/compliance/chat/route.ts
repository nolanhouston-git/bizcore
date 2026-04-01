import db from "@/lib/db";
import { getDownloadUrl } from "@/lib/r2";

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json() as {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    };

    // Business profile
    const business = db.prepare(
      `SELECT name, structure, city, state, county, entity_type
       FROM businesses WHERE id = 1`
    ).get() as { name: string; structure: string; city: string; state: string; county: string; entity_type: string } | undefined;

    // AI document access setting
    const aiDocRow = db.prepare(
      `SELECT value FROM settings WHERE business_id = 1 AND key = 'ai_document_access'`
    ).get() as { value: string } | undefined;
    const aiDocAccess = aiDocRow?.value !== "off"; // default on

    // Active compliance obligations
    const obligations = db.prepare(
      `SELECT name, jurisdiction, category
       FROM compliance_obligations
       WHERE business_id = 1 AND active = 1`
    ).all() as { name: string; jurisdiction: string | null; category: string | null }[];

    // Documents (if access is on)
    let documentLines = "";
    if (aiDocAccess) {
      const docs = db.prepare(
        `SELECT r2_key, file_name, category
         FROM documents
         WHERE business_id = 1 AND category = 'Compliance'
         LIMIT 10`
      ).all() as { r2_key: string; file_name: string; category: string }[];

      if (docs.length > 0) {
        // Verify docs are accessible (fire-and-forget presign check, just list names)
        const accessible: string[] = [];
        await Promise.all(docs.map(async (doc) => {
          const url = await getDownloadUrl(doc.r2_key);
          if (url) accessible.push(doc.file_name);
        }));
        if (accessible.length > 0) {
          documentLines =
            "\n\nUploaded compliance documents available for reference:\n" +
            accessible.map(n => `- ${n}`).join("\n");
        }
      }
    }

    // Build system prompt
    const obligationList = obligations.length > 0
      ? obligations.map(o => `- ${o.name}${o.jurisdiction ? ` (${o.jurisdiction})` : ""}`).join("\n")
      : "- No obligations on file";

    const systemPrompt =
      `You are a compliance advisor for ${business?.name ?? "this business"}, a ${business?.structure ?? "business"} based in ${business?.city ?? ""}, ${business?.state ?? ""}. You help the team understand and manage their regulatory, licensing, and tax filing obligations.\n\nCurrent compliance obligations on file:\n${obligationList}${documentLines}\n\nAnswer questions clearly and concisely. When relevant, cite specific deadlines, agencies, or filing requirements. If you are unsure about something, say so rather than guessing.`;

    // Call Anthropic API with streaming
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
        system: systemPrompt,
        messages: [...history, { role: "user", content: message }],
      }),
    });

    if (!anthropicRes.ok || !anthropicRes.body) {
      const errText = await anthropicRes.text();
      return new Response(`Anthropic API error: ${errText}`, { status: 500 });
    }

    // Transform SSE stream → plain text chunks
    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
                controller.enqueue(new TextEncoder().encode(parsed.delta.text));
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Compliance chat error:", err);
    return new Response(
      err instanceof Error ? err.message : "Internal server error",
      { status: 500 }
    );
  }
}
