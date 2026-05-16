import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { addDays, addMonths, endOfMonth, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/gantt";

export const runtime = "nodejs";

type ParsedOption = {
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  hint: string;
};

type ParsedRow = {
  rowIndex: number;
  title: string;
  description: string | null;
  ambiguous: boolean;
  due_start: string | null;
  due_end: string | null;
  due_label: string | null;
  alternatives: ParsedOption[];
};

// Hebrew month names. Indexed 1..12.
const HEBREW_MONTHS: Record<string, number> = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

/**
 * Parse a Hebrew/English date phrase into one or more candidate ranges.
 * Returns specific match (single resolution) or alternatives for ambiguous.
 */
function interpretDueText(
  raw: string,
  today: Date,
): {
  resolved?: { start: string; end: string; label: string | null };
  alternatives?: ParsedOption[];
} {
  const text = raw.trim();
  if (!text) return {};

  // Specific YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const s = toISODate(d);
    return { resolved: { start: s, end: s, label: null } };
  }

  // ISO range: YYYY-MM-DD–YYYY-MM-DD (en-dash, em-dash or hyphen)
  const isoRange = /^(\d{4}-\d{2}-\d{2})\s*[–—-]\s*(\d{4}-\d{2}-\d{2})$/.exec(
    text,
  );
  if (isoRange) {
    return {
      resolved: { start: isoRange[1], end: isoRange[2], label: null },
    };
  }

  // DD/MM/YYYY (common Israeli)
  const ddmm = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text);
  if (ddmm) {
    const d = new Date(Number(ddmm[3]), Number(ddmm[2]) - 1, Number(ddmm[1]));
    const s = toISODate(d);
    return { resolved: { start: s, end: s, label: null } };
  }

  // Hebrew month-only ("מרץ" / "מרץ 2026")
  const monthYear = /^([֐-׿]+)(?:\s+(\d{4}))?$/.exec(text);
  if (monthYear && HEBREW_MONTHS[monthYear[1]]) {
    const monthNum = HEBREW_MONTHS[monthYear[1]];
    const year = monthYear[2] ? Number(monthYear[2]) : today.getFullYear();
    const start = startOfMonth(new Date(year, monthNum - 1, 1));
    const end = endOfMonth(start);
    // If year is implicit and the month has already passed this year, surface
    // an alternative for next year.
    if (!monthYear[2] && end < today) {
      const nextStart = startOfMonth(new Date(year + 1, monthNum - 1, 1));
      const nextEnd = endOfMonth(nextStart);
      return {
        alternatives: [
          {
            due_start: toISODate(nextStart),
            due_end: toISODate(nextEnd),
            due_label: `${monthYear[1]} ${year + 1}`,
            hint: `${monthYear[1]} ${year + 1}`,
          },
          {
            due_start: toISODate(start),
            due_end: toISODate(end),
            due_label: `${monthYear[1]} ${year}`,
            hint: `${monthYear[1]} ${year}`,
          },
        ],
      };
    }
    return {
      resolved: {
        start: toISODate(start),
        end: toISODate(end),
        label: `${monthYear[1]} ${year}`,
      },
    };
  }

  // Quarter (Q1..Q4 [year])
  const quarter = /^Q([1-4])(?:\s+(\d{4}))?$/i.exec(text);
  if (quarter) {
    const q = Number(quarter[1]);
    const year = quarter[2] ? Number(quarter[2]) : today.getFullYear();
    const start = startOfMonth(new Date(year, (q - 1) * 3, 1));
    const end = endOfMonth(addMonths(start, 2));
    return {
      resolved: {
        start: toISODate(start),
        end: toISODate(end),
        label: `Q${q} ${year}`,
      },
    };
  }

  // Common Hebrew fuzzy phrases → alternatives
  const fuzzy: Record<string, ParsedOption[]> = {
    "סוף החודש": [
      {
        due_start: toISODate(endOfMonth(today)),
        due_end: toISODate(endOfMonth(today)),
        due_label: "סוף החודש",
        hint: `סוף ${today.getMonth() + 1}`,
      },
      {
        due_start: toISODate(addDays(endOfMonth(today), -3)),
        due_end: toISODate(endOfMonth(today)),
        due_label: "סוף החודש",
        hint: "3 הימים האחרונים בחודש",
      },
    ],
    "תחילת החודש": [
      {
        due_start: toISODate(startOfMonth(addMonths(today, 1))),
        due_end: toISODate(startOfMonth(addMonths(today, 1))),
        due_label: "תחילת החודש",
        hint: "1 בחודש הבא",
      },
      {
        due_start: toISODate(startOfMonth(addMonths(today, 1))),
        due_end: toISODate(addDays(startOfMonth(addMonths(today, 1)), 6)),
        due_label: "תחילת החודש",
        hint: "השבוע הראשון של החודש הבא",
      },
    ],
    "השבוע": [
      {
        due_start: toISODate(today),
        due_end: toISODate(addDays(today, 6)),
        due_label: "השבוע",
        hint: "7 הימים הקרובים",
      },
    ],
    "השבוע הבא": [
      {
        due_start: toISODate(addDays(today, 7)),
        due_end: toISODate(addDays(today, 13)),
        due_label: "השבוע הבא",
        hint: "השבוע הבא",
      },
    ],
  };
  if (fuzzy[text]) {
    return { alternatives: fuzzy[text] };
  }

  // Unrecognized → ambiguous with a single "no date" alternative.
  return {
    alternatives: [
      {
        due_start: null,
        due_end: null,
        due_label: text,
        hint: "ללא תאריך — שמור את הביטוי בלבד",
      },
    ],
  };
}

function cellValueAsString(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return toISODate(value);
  // Rich text cell value
  if (typeof value === "object" && "richText" in value && value.richText) {
    return value.richText.map((r) => r.text).join("");
  }
  // Hyperlink / formula
  if (typeof value === "object" && "text" in value && value.text) {
    return String((value as { text: unknown }).text);
  }
  if (typeof value === "object" && "result" in value) {
    const r = (value as { result: unknown }).result;
    return r === null || r === undefined ? "" : String(r);
  }
  return "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json(
      { error: "בקשה לא תקינה" },
      { status: 400 },
    );
  }
  if (!file) {
    return NextResponse.json({ error: "לא הועלה קובץ" }, { status: 400 });
  }

  let workbook: ExcelJS.Workbook;
  try {
    const arrayBuffer = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    // exceljs typings expect the historical (pre-TS-5.7) `Buffer` interface;
    // the runtime happily accepts any Uint8Array. The double-cast through
    // `unknown` keeps strict TS happy without resorting to `any`.
    const buf = Buffer.from(arrayBuffer) as unknown as Parameters<
      typeof workbook.xlsx.load
    >[0];
    await workbook.xlsx.load(buf);
  } catch (e) {
    return NextResponse.json(
      { error: "כשל בקריאת הקובץ", detail: String(e) },
      { status: 400 },
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json(
      { error: "הקובץ ריק" },
      { status: 400 },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: ParsedRow[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Skip the header row (rowNumber === 1).
    if (rowNumber === 1) return;
    const title = cellValueAsString(row.getCell(1).value).trim();
    if (!title) return;

    const dueRawCell = row.getCell(2).value;
    const dueRaw =
      dueRawCell instanceof Date
        ? toISODate(dueRawCell)
        : cellValueAsString(dueRawCell).trim();
    const description = cellValueAsString(row.getCell(3).value).trim();

    if (!dueRaw) {
      rows.push({
        rowIndex: rowNumber,
        title,
        description: description || null,
        ambiguous: false,
        due_start: null,
        due_end: null,
        due_label: null,
        alternatives: [],
      });
      return;
    }

    const interp = interpretDueText(dueRaw, today);
    if (interp.resolved) {
      rows.push({
        rowIndex: rowNumber,
        title,
        description: description || null,
        ambiguous: false,
        due_start: interp.resolved.start,
        due_end: interp.resolved.end,
        due_label: interp.resolved.label,
        alternatives: [],
      });
      return;
    }

    rows.push({
      rowIndex: rowNumber,
      title,
      description: description || null,
      ambiguous: true,
      due_start: null,
      due_end: null,
      due_label: dueRaw,
      alternatives: interp.alternatives ?? [],
    });
  });

  // Persist the raw parse so audit / re-finalize is possible.
  let importId: string | null = null;
  try {
    const { data: created } = await supabase
      .from("gantt_imports")
      .insert({
        original_filename: file.name,
        raw_json: { rows } as unknown as object,
        status: "parsing",
        owner_id: user.id,
      })
      .select("id")
      .single();
    importId = created?.id ?? null;
  } catch {
    // Non-fatal — the wizard can still proceed without an audit row.
  }

  return NextResponse.json({ importId, rows });
}
