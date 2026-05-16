import { Resend } from "resend";
import {
  buildTaskAssignedTemplate,
  type TaskAssignedTemplateInput,
} from "./email-templates/task-assigned";

let _client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Resend(key);
  return _client;
}

const FROM =
  process.env.EMAIL_FROM || "הנהלת CountMe <onboarding@resend.dev>";

export type TaskAssignedPayload = TaskAssignedTemplateInput & {
  to: string;
  toName: string;
};

export async function sendTaskAssignedEmail(
  payload: TaskAssignedPayload,
): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set — skipping");
    return;
  }
  const subject = `משימה חדשה: ${payload.taskTitle}`;
  const { html, text } = buildTaskAssignedTemplate(payload);
  try {
    await client.emails.send({
      from: FROM,
      to: [payload.to],
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}
