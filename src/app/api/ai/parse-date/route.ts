import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropic, HAIKU_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().min(1).max(500),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const alternativeSchema = z.object({
  due_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_label: z.string().max(80).nullable(),
  hint: z.string().max(120),
});

const parseResultSchema = z.object({
  title: z.string().min(1).max(200),
  due_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_label: z.string().max(80).nullable(),
  confidence: z.enum(["high", "med", "low"]),
  alternatives: z.array(alternativeSchema).max(3).optional(),
});

export type ParseDateResponse = z.infer<typeof parseResultSchema>;

const DATE_TOOL: Anthropic.Tool = {
  name: "emit_date_parse",
  description:
    "Extract a task title and a flexible Hebrew due-date range from free text. " +
    "Always call this tool exactly once with structured fields.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "The task title in Hebrew, with the date phrase stripped out. " +
          "If no clear non-date words exist, return the full original text. " +
          "Never include weekday/quarter/month/year tokens that came purely from the date phrase. " +
          "Trim trailing prepositions like 'ב', 'עד', 'ל-', 'תוך', 'מ-'.",
      },
      due_start: {
        type: "string",
        description:
          "Earliest possible date (YYYY-MM-DD). For a single day, equal to due_end. " +
          "For a range or fuzzy point, the start of the window.",
      },
      due_end: {
        type: "string",
        description:
          "Latest possible date (YYYY-MM-DD). For a single day, equal to due_start. " +
          "For a whole month or quarter, the last day of that period.",
      },
      due_label: {
        type: ["string", "null"],
        description:
          "Hebrew human-readable label when the date is a range or fuzzy point: " +
          "'מרץ 2026', 'Q2 2026', 'סוף החודש', 'תחילת מאי', 'אמצע יוני'. " +
          "Set to null only for a single specific calendar day.",
      },
      confidence: {
        type: "string",
        enum: ["high", "med", "low"],
        description:
          "high = clear single date/range; med = guessed year or ambiguous-but-likely; " +
          "low = unable to parse a date at all (then fall back to today as start=end and original text as label).",
      },
      alternatives: {
        type: "array",
        description:
          "Optional 1-3 alternative interpretations the user might mean. " +
          "Include only when the input is genuinely ambiguous (e.g. 'Q2' could be this year or next).",
        items: {
          type: "object",
          properties: {
            due_start: { type: "string" },
            due_end: { type: "string" },
            due_label: { type: ["string", "null"] },
            hint: {
              type: "string",
              description: "Short Hebrew hint describing this interpretation, e.g. 'Q2 שנה הבאה'.",
            },
          },
          required: ["due_start", "due_end", "due_label", "hint"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "due_start", "due_end", "due_label", "confidence"],
    additionalProperties: false,
  },
};

function buildSystemPrompt(today: string): string {
  // The system prompt teaches the model Hebrew date conventions and grounds it on today's date.
  return `אתה מנתח קלט עברי חופשי לפעולות יצירת משימה במערכת CRM פנימית.
המטרה: לפרק את הקלט לכותרת + טווח תאריכים אפשרי + תווית עברית קריאה אם רלוונטי.

תאריך היום: ${today} (היום השבועי בפועל יוסק לפי תאריך זה).

כללי תרגום טווחי זמן בעברית — תמיד ביחס לתאריך היום:
• "היום" → due_start = due_end = היום, label = null.
• "מחר" → due_start = due_end = היום + 1 יום, label = null.
• "אתמול" → due_start = due_end = היום - 1 יום, label = null.
• "בעוד X ימים" / "בעוד שבוע" / "בעוד חודש" / "בעוד שנה" → תאריך יחיד, label = null.
• "יום ראשון הבא" / "ביום ראשון" / "השבת" → היום הקרוב באותה שם בשבוע (אם כבר עבר היום, השבוע הבא), single-day, label = null.
• "השבוע" → due_start = ראשון של השבוע הנוכחי, due_end = שבת של השבוע הנוכחי, label = "השבוע".
• "החודש" → תחילת החודש הנוכחי עד סופו, label = "<שם החודש> <שנה>" (למשל "מאי 2026").
• "כל מרץ", "מרץ", "במרץ" → חודש שלם (1.3 עד 31.3) של השנה הקרובה (אם החודש כבר עבר השנה, השנה הבאה), label = "מרץ <שנה>".
  אם המשתמש כתב במפורש שנה ("מרץ 2027") — השתמש בה.
• "תחילת מרץ" → due_start = 1 במרץ, due_end = 10 במרץ, label = "תחילת מרץ".
• "אמצע מאי" → due_start = 11 במאי, due_end = 20 במאי, label = "אמצע מאי".
• "סוף החודש" → due_start = 22 בחודש, due_end = יום אחרון של החודש, label = "סוף החודש".
• "Q1/Q2/Q3/Q4" או "רבעון 1/2/3/4" → טווח של 3 חודשים מלא:
    Q1 = 1.1-31.3, Q2 = 1.4-30.6, Q3 = 1.7-30.9, Q4 = 1.10-31.12.
    אם לא צוינה שנה — השנה הנוכחית. label = "Q<N> <שנה>".
• "הרבעון" → הרבעון הנוכחי לפי תאריך היום, label = "Q<N> <שנה>".
• "השנה" → 1 בינואר עד 31 בדצמבר של השנה הנוכחית, label = "<שנה>".

חוסר ודאות:
• אם המשתמש כתב רק "Q2" בלי שנה, וייתכן שהוא מתכוון לרבעון הבא של השנה הבאה — הוסף ב-alternatives את הפרשנות החלופית עם hint קצר ("Q2 שנה הבאה").
• אם הקלט לא מכיל ביטוי תאריך כלל — confidence = "low", due_start = due_end = ${today}, due_label = הקלט המקורי, title = הקלט המקורי.

חילוץ כותרת:
• הסר את ביטוי התאריך והמילות יחס שמסביבו ("ב-", "עד", "תוך", "ל-", "כל", "במהלך").
• השאר את הטקסט בעברית כפי שהמשתמש כתב, רק מצומצם.
• אם אחרי ההסרה לא נשארה כותרת משמעותית, החזר את הקלט המקורי.

חובה: קרא לכלי emit_date_parse פעם אחת בדיוק.`;
}

function todayInIsraelISO(): string {
  // Default "today" if the client didn't supply one. The clients running in the IL timezone
  // will get the right value; otherwise the explicit `today` field overrides.
  const now = new Date();
  // Use Asia/Jerusalem offset via Intl
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // "YYYY-MM-DD"
}

function fallbackResponse(text: string, today: string): ParseDateResponse {
  return {
    title: text.trim().slice(0, 200) || text.trim(),
    due_start: today,
    due_end: today,
    due_label: text.trim().slice(0, 80),
    confidence: "low",
  };
}

export async function POST(req: NextRequest) {
  // Authenticated route — only signed-in team members may call this.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const today = parsed.data.today ?? todayInIsraelISO();
  const text = parsed.data.text.trim();

  let result: ParseDateResponse;
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      system: buildSystemPrompt(today),
      tools: [DATE_TOOL],
      tool_choice: { type: "tool", name: "emit_date_parse" },
      messages: [
        {
          role: "user",
          content: text,
        },
      ],
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "emit_date_parse",
    );

    if (!toolBlock) {
      // The model didn't call the tool — fall back gracefully.
      result = fallbackResponse(text, today);
    } else {
      const candidate = parseResultSchema.safeParse(toolBlock.input);
      if (!candidate.success) {
        result = fallbackResponse(text, today);
      } else {
        result = candidate.data;
      }
    }
  } catch (err) {
    console.error("parse-date: anthropic call failed", err);
    result = fallbackResponse(text, today);
  }

  return NextResponse.json(result);
}
