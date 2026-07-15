import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { FinancingRequestFile } from "./types";
import { saveFileBlob } from "./store";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".pdf",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
]);

export type UploadKind = "company_pdf" | "attachment" | "monitoring_statement";

type StorageMode = "local" | "database";

function storageMode(): StorageMode {
  const configured = String(process.env.FILE_STORAGE || "").toLowerCase();
  if (configured === "local" || configured === "database") return configured;
  return process.env.DATABASE_URL ? "database" : "local";
}

export async function saveUploadedFile(
  ticketId: string,
  file: File,
  kind: UploadKind,
): Promise<{ metadata: FinancingRequestFile; buffer: Buffer }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  validateFile(file, buffer.length, kind);
  if (kind === "company_pdf") assertPdfMagicBytes(buffer);

  const fileId = randomUUID();
  const originalName = safeOriginalName(file.name || `${kind}.bin`);
  const extension = path.extname(originalName).toLowerCase();
  const storedName = `${Date.now()}-${randomUUID()}${extension || ".bin"}`;
  const mimeType = file.type || "application/octet-stream";
  const uploadedAt = new Date().toISOString();
  const mode = storageMode();

  if (mode === "database") {
    const storageKey = await saveFileBlob({
      ticketId,
      fileId,
      originalName,
      mimeType,
      contentBase64: buffer.toString("base64"),
      createdAt: uploadedAt,
    });
    return {
      buffer,
      metadata: {
        id: fileId,
        kind,
        originalName,
        storedName,
        path: `database://${storageKey}`,
        storage: "database",
        storageKey,
        mimeType,
        size: buffer.length,
        uploadedAt,
      },
    };
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_EPHEMERAL_FILE_STORAGE !== "true"
  ) {
    throw new Error(
      "FILE_STORAGE=local is not allowed in production. Use FILE_STORAGE=database or explicitly allow ephemeral storage.",
    );
  }

  const relativePath = path.join(
    "uploads",
    "financing-requests",
    ticketId,
    storedName,
  );
  const absolutePath = path.join(process.cwd(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    buffer,
    metadata: {
      id: fileId,
      kind,
      originalName,
      storedName,
      path: relativePath,
      storage: "local",
      storageKey: relativePath,
      mimeType,
      size: buffer.length,
      uploadedAt,
    },
  };
}

export function assertPdfMagicBytes(buffer: Buffer) {
  if (buffer.length < 5 || buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw new Error("الملف المرفوع ليس ملف PDF صالحاً");
  }
}

export function validateFile(file: File, size: number, kind: UploadKind) {
  const name = file.name || "";
  const extension = path.extname(name).toLowerCase();
  const mime = file.type || "";

  if (kind === "company_pdf") {
    if (size > MAX_PDF_SIZE) {
      throw new Error("حجم ملف PDF يجب ألا يتجاوز 10MB");
    }
    if (extension !== ".pdf" && mime !== "application/pdf") {
      throw new Error("ملف معلومات الشركة يجب أن يكون بصيغة PDF");
    }
    return;
  }

  if (size > MAX_ATTACHMENT_SIZE) {
    throw new Error("حجم كل مرفق إضافي يجب ألا يتجاوز 15MB");
  }
  if (
    !ALLOWED_ATTACHMENT_TYPES.has(mime) &&
    !ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)
  ) {
    throw new Error(
      "نوع المرفق غير مدعوم. الصيغ المسموحة: PDF, Excel, CSV, PNG, JPG",
    );
  }
}

export function validateAttachmentCount(files: File[]) {
  if (files.length > MAX_ATTACHMENTS) {
    throw new Error("الحد الأقصى للمرفقات الإضافية هو 5 ملفات");
  }
}

export function safeOriginalName(name: string) {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 160) || "attachment";
}

export function publicFileSummary(file: FinancingRequestFile) {
  return {
    id: file.id,
    kind: file.kind,
    documentType: file.documentType,
    displayLabel: file.displayLabel,
    required: file.required,
    verificationStatus: file.verificationStatus,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    uploadedAt: file.uploadedAt,
  };
}
