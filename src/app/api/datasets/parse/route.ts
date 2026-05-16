import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  DATASET_MAX_COLUMNS,
  DATASET_MAX_ROWS,
  type ColumnDef,
  coerceValue,
  detectColumnType,
  headerToKey,
} from "@/lib/datasets";

export const runtime = "nodejs";

type ParseResponse = {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  total_rows: number;
  warnings: string[];
};

// How many sample rows to read for type inference. Anything beyond this is
// noise — Excel users typically establish column conventions in the first
// dozen rows.
const TYPE_SAMPLE_SIZE = 50;

function cellValueAsString(value: ExcelJS.CellValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    // Render Excel dates as ISO date-only so they round-trip into the date
    // detector below.
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object") {
    // Rich text
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value) {
      const r = (value as { result: unknown }).result;
      return r === null || r === undefined ? "" : String(r);
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
  }
  return "";
}

/**
 * Lightweight CSV parser. Handles:
 *   - quoted fields with embedded commas / newlines
 *   - doubled-quote escapes ("" inside quoted field)
 *   - both \r\n and \n line endings
 *
 * Returns a 2D array; the caller decides which row is the header.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        // Doubled quote → literal quote inside quoted field
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // Treat \r\n as a single newline
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  // Flush any trailing cell/row that didn't end with a newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop empty trailing rows (common at EOF)
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0].trim() === "") {
      rows.pop();
    } else {
      break;
    }
  }
  return rows;
}

async function parseXLSX(
  buffer: ArrayBuffer,
): Promise<{ headers: string[]; rows: string[][] }> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect the legacy Node `Buffer` interface; the runtime
  // happily accepts any Uint8Array. Cast through unknown keeps strict TS happy.
  const buf = Buffer.from(buffer) as unknown as Parameters<
    typeof workbook.xlsx.load
  >[0];
  await workbook.xlsx.load(buf);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  const headers: string[] = [];
  const rows: string[][] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // exceljs is 1-indexed and cell at index 0 is unused.
    const cells: string[] = [];
    const colCount = Math.max(
      row.cellCount,
      sheet.columnCount,
      headers.length || 0,
    );
    for (let c = 1; c <= colCount; c++) {
      cells.push(cellValueAsString(row.getCell(c).value).trim());
    }
    if (rowNumber === 1) {
      // Trim trailing empties from header so we don't manufacture phantom cols
      while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
      headers.push(...cells);
      return;
    }
    // Truncate / pad to header width
    const widthAligned: string[] = [];
    for (let i = 0; i < headers.length; i++) widthAligned.push(cells[i] ?? "");
    // Skip fully-empty rows
    if (widthAligned.every((v) => v === "")) return;
    rows.push(widthAligned);
  });

  return { headers, rows };
}

function buildColumnDefs(
  headers: string[],
  rows: string[][],
): { columns: ColumnDef[]; warnings: string[] } {
  const warnings: string[] = [];

  // Sanitize headers, dedupe by suffixing _2, _3, …
  const seen = new Map<string, number>();
  const columns: ColumnDef[] = headers.map((h, idx) => {
    let key = headerToKey(h, idx);
    const count = seen.get(key) ?? 0;
    if (count > 0) {
      key = `${key}_${count + 1}`;
    }
    seen.set(headerToKey(h, idx), count + 1);

    const samples: string[] = [];
    for (
      let r = 0;
      r < rows.length && samples.length < TYPE_SAMPLE_SIZE;
      r++
    ) {
      const v = rows[r][idx];
      if (typeof v === "string" && v.trim() !== "") samples.push(v);
    }
    const type = detectColumnType(samples);

    const label = (h ?? "").trim() || `עמודה ${idx + 1}`;
    return { key, label, type, order: idx };
  });

  return { columns, warnings };
}

function buildDataRows(
  columns: ColumnDef[],
  rawRows: string[][],
): Record<string, unknown>[] {
  return rawRows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      const raw = row[col.order] ?? "";
      obj[col.key] = coerceValue(raw, col.type);
    }
    return obj;
  });
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
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "לא הועלה קובץ" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
  const isCsv = name.endsWith(".csv");
  if (!isXlsx && !isCsv) {
    return NextResponse.json(
      { error: "פורמט לא נתמך — רק XLSX, XLS או CSV" },
      { status: 400 },
    );
  }

  let headers: string[];
  let rawRows: string[][];
  try {
    if (isXlsx) {
      const arrayBuffer = await file.arrayBuffer();
      const parsed = await parseXLSX(arrayBuffer);
      headers = parsed.headers;
      rawRows = parsed.rows;
    } else {
      const text = await file.text();
      const grid = parseCSV(text);
      headers = grid[0] ?? [];
      // Trim trailing empty header columns
      while (headers.length > 0 && headers[headers.length - 1].trim() === "") {
        headers.pop();
      }
      rawRows = grid.slice(1).map((row) => {
        const aligned: string[] = [];
        for (let i = 0; i < headers.length; i++) aligned.push(row[i] ?? "");
        return aligned;
      });
      // Filter fully-empty rows
      rawRows = rawRows.filter((row) => row.some((v) => v.trim() !== ""));
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "כשל בקריאת הקובץ",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  if (headers.length === 0) {
    return NextResponse.json(
      { error: "לא נמצאה שורת כותרות בקובץ" },
      { status: 400 },
    );
  }

  const warnings: string[] = [];

  if (headers.length > DATASET_MAX_COLUMNS) {
    warnings.push(
      `מעל ${DATASET_MAX_COLUMNS} עמודות — נשמרות רק ${DATASET_MAX_COLUMNS} הראשונות`,
    );
    headers = headers.slice(0, DATASET_MAX_COLUMNS);
    rawRows = rawRows.map((r) => r.slice(0, DATASET_MAX_COLUMNS));
  }

  const totalRows = rawRows.length;
  if (totalRows > DATASET_MAX_ROWS) {
    warnings.push(
      `מעל ${DATASET_MAX_ROWS.toLocaleString(
        "he-IL",
      )} שורות — נשמרות רק ${DATASET_MAX_ROWS.toLocaleString("he-IL")} הראשונות`,
    );
    rawRows = rawRows.slice(0, DATASET_MAX_ROWS);
  }

  const { columns, warnings: colWarnings } = buildColumnDefs(headers, rawRows);
  warnings.push(...colWarnings);
  const rows = buildDataRows(columns, rawRows);

  const response: ParseResponse = {
    columns,
    rows,
    total_rows: rawRows.length,
    warnings,
  };
  return NextResponse.json(response);
}
