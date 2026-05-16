import { getAnthropic, SONNET_MODEL } from "@/lib/anthropic";
import { HELP_SECTIONS } from "@/lib/help-content";

export const runtime = "nodejs";

type Message = { role: "user" | "assistant"; content: string };

function buildSystemPrompt(): string {
  const corpus = HELP_SECTIONS.map((s) => {
    const blocks = s.body
      .map((b) => {
        if (b.type === "heading") return `## ${b.text}`;
        if (b.type === "list") return b.items.map((i) => `- ${i}`).join("\n");
        if (b.type === "tip") return `> טיפ: ${b.text}`;
        if (b.type === "code") return "`" + b.text + "`";
        return b.text;
      })
      .join("\n\n");
    return `# ${s.title} (#${s.id})\n${blocks}`;
  }).join("\n\n");

  return [
    "אתה עוזר תמיכה של מערכת CRM פנימית בעברית בשם \"הנהלת CountMe\".",
    "ענה תמיד בעברית, בתמציתיות (1-4 משפטים בדרך כלל).",
    "השתמש אך ורק במידע שב\"מדריך\" למטה. אם המשתמש שואל על משהו שאינו נמצא במדריך, הסבר בקצרה שזה לא תועד ועדיף לפנות לאדמין.",
    "אל תמציא פיצ'רים, קיצורי מקלדת, או מסכים שאינם מוזכרים.",
    "כשהמשתמש שואל \"איך לעשות X\", תן צעדים מסודרים ברורים. הימנע מפסקאות ארוכות.",
    "",
    "## המדריך:",
    "",
    corpus,
  ].join("\n");
}

export async function POST(req: Request): Promise<Response> {
  let body: { messages?: Message[] };
  try {
    body = (await req.json()) as { messages?: Message[] };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0,
  );
  if (messages.length === 0) {
    return new Response("messages required", { status: 400 });
  }

  const anthropic = getAnthropic();
  const system = buildSystemPrompt();

  const stream = await anthropic.messages.stream({
    model: SONNET_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode("\n\n[שגיאה: " + String(err) + "]"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
