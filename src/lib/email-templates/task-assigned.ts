export type TaskAssignedTemplateInput = {
  toName: string;
  taskTitle: string;
  taskDescription: string | null;
  dueDisplay: string; // pre-formatted, e.g. "Q2 2026" or "ב־17 במאי"
  priority: "low" | "med" | "high";
  status: "todo" | "doing" | "done";
  assignedByName: string;
  taskUrl: string;
};

const PRIORITY_LABELS_HE: Record<TaskAssignedTemplateInput["priority"], string> = {
  low: "נמוכה",
  med: "בינונית",
  high: "גבוהה",
};

const STATUS_LABELS_HE: Record<TaskAssignedTemplateInput["status"], string> = {
  todo: "לעשות",
  doing: "בביצוע",
  done: "הושלם",
};

// chip color = { bg, text }
const PRIORITY_COLORS: Record<
  TaskAssignedTemplateInput["priority"],
  { bg: string; text: string }
> = {
  low: { bg: "#f1f5f9", text: "#334155" }, // slate
  med: { bg: "#f5efe3", text: "#7a6238" }, // brand
  high: { bg: "#fee2e2", text: "#991b1b" }, // red
};

const STATUS_COLORS: Record<
  TaskAssignedTemplateInput["status"],
  { bg: string; text: string }
> = {
  todo: { bg: "#f1f5f9", text: "#334155" }, // slate
  doing: { bg: "#f5efe3", text: "#7a6238" }, // brand
  done: { bg: "#dcfce7", text: "#166534" }, // green
};

const BRAND = "#A88A5B";
const BRAND_DARK = "#7a6238";
const FONT_STACK =
  '"Heebo", "Arial Hebrew", Tahoma, sans-serif';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chip(label: string, bg: string, text: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${text};font-size:13px;font-weight:600;line-height:1.2;">${escapeHtml(
    label,
  )}</span>`;
}

export function buildTaskAssignedTemplate(
  input: TaskAssignedTemplateInput,
): { html: string; text: string } {
  const {
    toName,
    taskTitle,
    taskDescription,
    dueDisplay,
    priority,
    status,
    assignedByName,
    taskUrl,
  } = input;

  const priorityColors = PRIORITY_COLORS[priority];
  const statusColors = STATUS_COLORS[status];
  const priorityLabel = PRIORITY_LABELS_HE[priority];
  const statusLabel = STATUS_LABELS_HE[status];

  const descriptionBlock = taskDescription?.trim()
    ? `<tr><td style="padding:0 24px 16px 24px;">
        <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#475569;white-space:pre-wrap;">${escapeHtml(
          taskDescription.trim(),
        )}</div>
      </td></tr>`
    : "";

  const dueChip = dueDisplay
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#f8fafc;color:#334155;font-size:13px;font-weight:600;line-height:1.2;border:1px solid #e2e8f0;">${escapeHtml(
        dueDisplay,
      )}</span>`
    : "";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(`משימה חדשה: ${taskTitle}`)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${FONT_STACK};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:28px 24px;text-align:right;">
              <div style="font-family:${FONT_STACK};font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">הנהלת CountMe</div>
              <div style="font-family:${FONT_STACK};font-size:14px;font-weight:500;color:rgba(255,255,255,0.9);margin-top:4px;">משימה חדשה הוקצתה לך</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px 24px;">
              <div style="font-family:${FONT_STACK};font-size:16px;color:#0f172a;font-weight:600;">שלום ${escapeHtml(
                toName,
              )},</div>
              <div style="font-family:${FONT_STACK};font-size:15px;color:#475569;margin-top:6px;line-height:1.5;">${escapeHtml(
                assignedByName,
              )} שייך/ה אליך משימה חדשה:</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fafaf9;border:1px solid #e7e5e4;border-right:4px solid ${BRAND};border-radius:8px;">
                <tr>
                  <td style="padding:18px 20px 8px 20px;">
                    <div style="font-family:${FONT_STACK};font-size:20px;font-weight:700;color:#0f172a;line-height:1.35;">${escapeHtml(
                      taskTitle,
                    )}</div>
                  </td>
                </tr>
                ${descriptionBlock}
                <tr>
                  <td style="padding:8px 20px 18px 20px;">
                    <div>
                      ${dueChip}
                      ${chip(`עדיפות: ${priorityLabel}`, priorityColors.bg, priorityColors.text)}
                      ${chip(`סטטוס: ${statusLabel}`, statusColors.bg, statusColors.text)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;text-align:center;">
              <a href="${escapeHtml(
                taskUrl,
              )}" style="display:inline-block;padding:12px 28px;background:${BRAND};color:#ffffff;text-decoration:none;font-family:${FONT_STACK};font-size:15px;font-weight:600;border-radius:8px;">פתח משימה</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px 24px;text-align:center;">
              <div style="font-family:${FONT_STACK};font-size:12px;color:#94a3b8;line-height:1.5;">
                ההודעה נשלחה מהמערכת הפנימית של CountMe • <a href="${escapeHtml(
                  taskUrl,
                )}" style="color:#94a3b8;text-decoration:underline;">קישור</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts: string[] = [];
  textParts.push(`שלום ${toName},`);
  textParts.push("");
  textParts.push(`${assignedByName} שייך/ה אליך משימה חדשה:`);
  textParts.push("");
  textParts.push(taskTitle);
  if (taskDescription?.trim()) {
    textParts.push("");
    textParts.push(taskDescription.trim());
  }
  textParts.push("");
  if (dueDisplay) textParts.push(`מועד: ${dueDisplay}`);
  textParts.push(`עדיפות: ${priorityLabel}`);
  textParts.push(`סטטוס: ${statusLabel}`);
  textParts.push("");
  textParts.push(`פתח משימה: ${taskUrl}`);
  textParts.push("");
  textParts.push("ההודעה נשלחה מהמערכת הפנימית של CountMe");
  const text = textParts.join("\n");

  return { html, text };
}
