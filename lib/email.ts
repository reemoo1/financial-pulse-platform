import nodemailer from "nodemailer";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { saveOutboxEmail } from "./store";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface SendTicketEmailInput {
  to?: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}

export interface EmailDeliveryResult {
  status: "sent" | "skipped" | "failed";
  to?: string;
  message?: string;
  at: string;
}

export async function sendTicketEmail(
  input: SendTicketEmailInput,
): Promise<EmailDeliveryResult> {
  const to =
    input.to ||
    process.env.PROVIDER_EMAIL ||
    process.env.SUPPLIER_EMAIL ||
    "";
  const host = process.env.SMTP_HOST || "";
  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "Financial Pulse <no-reply@financial-pulse.local>";
  const at = new Date().toISOString();

  if (!to || !host) {
    await persistOutbox({ ...input, to: to || "غير محدد", from });
    return {
      status: "skipped",
      to: to || undefined,
      message:
        "لم يتم ضبط SMTP_HOST أو PROVIDER_EMAIL؛ تم حفظ الرسالة في صندوق الصادر المحلي/قاعدة البيانات.",
      at,
    };
  }

  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      requireTLS:
        process.env.SMTP_STARTTLS !== "false" &&
        process.env.SMTP_SECURE !== "true" &&
        port !== 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10_000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10_000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20_000),
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_INSECURE !== "true",
      },
    });

    await transporter.sendMail({
      from,
      to,
      subject: input.subject,
      text: input.text,
      attachments: (input.attachments || []).map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content,
      })),
    });

    return { status: "sent", to, at };
  } catch (error: any) {
    await persistOutbox({ ...input, to, from });
    return {
      status: "failed",
      to,
      message:
        error?.message ||
        "تعذر إرسال البريد عبر SMTP؛ تم حفظ نسخة في صندوق الصادر.",
      at,
    };
  }
}

async function persistOutbox(
  input: SendTicketEmailInput & { to: string; from: string },
) {
  const rawMime = buildOutboxMessage(input);
  const createdAt = new Date().toISOString();
  const mode = String(process.env.OUTBOX_STORAGE || "").toLowerCase();
  const useDatabase = mode === "database" || (!mode && Boolean(process.env.DATABASE_URL));

  if (useDatabase) {
    await saveOutboxEmail({
      to: input.to,
      from: input.from,
      subject: input.subject,
      rawMime,
      createdAt,
    });
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_EPHEMERAL_FILE_STORAGE !== "true"
  ) {
    throw new Error(
      "Local outbox storage is not durable in production. Set OUTBOX_STORAGE=database.",
    );
  }

  const directory = path.join(process.cwd(), "uploads", "outbox");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${Date.now()}-${randomUUID()}.eml`),
    rawMime,
    "utf8",
  );
}

function buildOutboxMessage(
  input: SendTicketEmailInput & { to: string; from: string },
) {
  const boundary = `financial-pulse-${randomUUID()}`;
  const lines = [
    `From: ${sanitizeHeader(input.from)}`,
    `To: ${sanitizeHeader(input.to)}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
  ];

  for (const attachment of input.attachments || []) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType || "application/octet-stream"}; name="${sanitizeHeader(attachment.filename)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${sanitizeHeader(attachment.filename)}"`,
      "",
      attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n"),
    );
  }
  lines.push(`--${boundary}--`, "");
  return lines.join("\r\n");
}

function sanitizeHeader(value: string) {
  return String(value).replace(/[\r\n"]/g, "_");
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
