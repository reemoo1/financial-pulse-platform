// Persistence layer:
// - PostgreSQL when DATABASE_URL is configured.
// - A serialized lowdb JSON store for local development only.

import { v4 as uuidv4 } from "uuid";
import {
  BankUser,
  BankCreditReview,
  BankRole,
  CollateralPackage,
  CompanyReportData,
  CompanyUser,
  FinancingRequestRecord,
  FinancingRequestStatus,
  ReportType,
  StartupReportData,
  StoredFileBlob,
  StoredFinancingRequest,
  StoredOutboxEmail,
  StoredReport,
  TicketSecurity,
} from "./types";
import { refreshFinancingLifecycleStatus } from "./financingLifecycle";
import { recalculateCollateralPackage, syncLifecycleWithCollateral } from "./collateral";
import { verifyOtp, generateReferenceNumber } from "./otp";

const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
const DEFAULT_OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 30);
const DEFAULT_OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 3);

type RecordDataMap = {
  company: CompanyReportData;
  startup: StartupReportData;
  financing_request: FinancingRequestRecord;
  bank_user: BankUser;
  company_user: CompanyUser;
  file_blob: StoredFileBlob;
  outbox_email: StoredOutboxEmail;
};

export type RecordType = keyof RecordDataMap;

type GenericRecord<K extends RecordType = RecordType> = {
  [T in K]: {
    id: string;
    type: T;
    createdAt: string;
    data: RecordDataMap[T];
  };
}[K];

function assertStorageConfiguration() {
  if (
    !USE_POSTGRES &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_STORE_IN_PRODUCTION !== "true"
  ) {
    throw new Error(
      "DATABASE_URL is required in production. The lowdb JSON store is development-only.",
    );
  }
}

/* ------------------------------------------------------------------ *
 * PostgreSQL
 * ------------------------------------------------------------------ */

let poolInstance: import("pg").Pool | null = null;

function getPostgresSsl(): import("tls").ConnectionOptions | undefined {
  const mode = (
    process.env.POSTGRES_SSL_MODE ||
    process.env.DATABASE_SSL_MODE ||
    "disable"
  ).toLowerCase();

  if (["disable", "false", "off", "none"].includes(mode)) return undefined;
  if (["insecure", "no-verify", "allow-self-signed"].includes(mode)) {
    return { rejectUnauthorized: false };
  }

  const ca = process.env.POSTGRES_SSL_CA?.replace(/\\n/g, "\n");
  return {
    rejectUnauthorized: true,
    ...(ca ? { ca } : {}),
  };
}

function getPool(): import("pg").Pool {
  if (!poolInstance) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg");
    const ssl = getPostgresSsl();
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(ssl ? { ssl } : {}),
    });
  }
  return poolInstance;
}

function normalizeRow<K extends RecordType>(row: {
  id: string;
  type: K;
  created_at: string | Date;
  data: RecordDataMap[K] | string;
}): GenericRecord<K> {
  return {
    id: row.id,
    type: row.type,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    data:
      typeof row.data === "string"
        ? (JSON.parse(row.data) as RecordDataMap[K])
        : row.data,
  } as GenericRecord<K>;
}

async function savePostgresRecord<K extends RecordType>(
  type: K,
  data: RecordDataMap[K],
  preferredId?: string,
): Promise<string> {
  const id = preferredId || uuidv4();
  await getPool().query(
    `INSERT INTO reports (id, type, created_at, data) VALUES ($1, $2, $3, $4)`,
    [id, type, new Date().toISOString(), JSON.stringify(data)],
  );
  return id;
}

async function getPostgresRecord(id: string): Promise<GenericRecord | null> {
  const result = await getPool().query(
    `SELECT id, type, created_at, data FROM reports WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? normalizeRow(row) : null;
}

async function listPostgresRecordsByType<K extends RecordType>(
  type: K,
): Promise<GenericRecord<K>[]> {
  const result = await getPool().query(
    `SELECT id, type, created_at, data FROM reports WHERE type = $1 ORDER BY created_at DESC`,
    [type],
  );
  return result.rows.map((row) => normalizeRow<K>(row));
}

async function updatePostgresRecordData<K extends RecordType>(
  id: string,
  type: K,
  data: RecordDataMap[K],
): Promise<GenericRecord<K> | null> {
  const result = await getPool().query(
    `UPDATE reports SET data = $1 WHERE id = $2 AND type = $3
     RETURNING id, type, created_at, data`,
    [JSON.stringify(data), id, type],
  );
  const row = result.rows[0];
  return row ? normalizeRow<K>(row) : null;
}

/* ------------------------------------------------------------------ *
 * lowdb — development only, with serialized writes
 * ------------------------------------------------------------------ */

interface DBSchema {
  reports: Record<string, GenericRecord>;
}

let dbPromise: Promise<{
  data: DBSchema;
  write: () => Promise<void>;
}> | null = null;
let fileWriteQueue: Promise<void> = Promise.resolve();

async function getFileDb() {
  assertStorageConfiguration();
  if (!dbPromise) {
    const { JSONFilePreset } = await import("lowdb/node");
    const path = await import("path");
    const dbPath = path.join(process.cwd(), "data", "db.json");
    dbPromise = JSONFilePreset<DBSchema>(dbPath, { reports: {} });
  }
  const db = await dbPromise;
  db.data ||= { reports: {} };
  db.data.reports ||= {};
  return db;
}

function withFileWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = fileWriteQueue.then(operation, operation);
  fileWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function saveFileRecord<K extends RecordType>(
  type: K,
  data: RecordDataMap[K],
  preferredId?: string,
): Promise<string> {
  return withFileWriteLock(async () => {
    const db = await getFileDb();
    const id = preferredId || uuidv4();
    db.data.reports[id] = {
      id,
      type,
      createdAt: new Date().toISOString(),
      data,
    } as GenericRecord;
    await db.write();
    return id;
  });
}

async function getFileRecord(id: string): Promise<GenericRecord | null> {
  const db = await getFileDb();
  return db.data.reports[id] || null;
}

async function listFileRecordsByType<K extends RecordType>(
  type: K,
): Promise<GenericRecord<K>[]> {
  const db = await getFileDb();
  const records = Object.values(db.data.reports).filter(
    (record) => record.type === type,
  ) as GenericRecord<K>[];
  return records.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() -
      new Date(left.createdAt).getTime(),
  );
}

async function updateFileRecordData<K extends RecordType>(
  id: string,
  type: K,
  data: RecordDataMap[K],
): Promise<GenericRecord<K> | null> {
  return withFileWriteLock(async () => {
    const db = await getFileDb();
    const record = db.data.reports[id];
    if (!record || record.type !== type) return null;
    const updated = { ...record, data } as GenericRecord<K>;
    db.data.reports[id] = updated as GenericRecord;
    await db.write();
    return updated;
  });
}

async function saveRecord<K extends RecordType>(
  type: K,
  data: RecordDataMap[K],
  preferredId?: string,
): Promise<string> {
  assertStorageConfiguration();
  return USE_POSTGRES
    ? savePostgresRecord(type, data, preferredId)
    : saveFileRecord(type, data, preferredId);
}

async function getRecord(id: string): Promise<GenericRecord | null> {
  assertStorageConfiguration();
  return USE_POSTGRES ? getPostgresRecord(id) : getFileRecord(id);
}

async function listRecordsByType<K extends RecordType>(
  type: K,
): Promise<GenericRecord<K>[]> {
  assertStorageConfiguration();
  return USE_POSTGRES
    ? listPostgresRecordsByType(type)
    : listFileRecordsByType(type);
}

async function updateRecordData<K extends RecordType>(
  id: string,
  type: K,
  data: RecordDataMap[K],
): Promise<GenericRecord<K> | null> {
  assertStorageConfiguration();
  return USE_POSTGRES
    ? updatePostgresRecordData(id, type, data)
    : updateFileRecordData(id, type, data);
}

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

export async function saveReport(
  type: ReportType,
  data: CompanyReportData | StartupReportData,
): Promise<string> {
  if (type === "company") {
    return saveRecord("company", data as CompanyReportData);
  }
  return saveRecord("startup", data as StartupReportData);
}

export async function getReport(id: string): Promise<StoredReport | null> {
  const record = await getRecord(id);
  if (!record || (record.type !== "company" && record.type !== "startup")) {
    return null;
  }
  return record as StoredReport;
}

/* ------------------------------------------------------------------ *
 * Financing requests
 * ------------------------------------------------------------------ */

function withDefaultSecurity(
  security: TicketSecurity | undefined,
): TicketSecurity | undefined {
  if (!security) return undefined;
  const created = new Date(security.otpCreatedAt || Date.now());
  const expiry = new Date(
    created.getTime() + DEFAULT_OTP_TTL_MINUTES * 60_000,
  ).toISOString();
  return {
    ...security,
    otpExpiresAt: security.otpExpiresAt || expiry,
    otpAttemptCount: Number(security.otpAttemptCount || 0),
    otpMaxAttempts: Number(
      security.otpMaxAttempts || DEFAULT_OTP_MAX_ATTEMPTS,
    ),
  };
}

function withDefaultRequestStatus(
  data: FinancingRequestRecord,
): FinancingRequestRecord {
  const now = new Date().toISOString();
  const status = data.status || "submitted";
  const submissionDate = data.metadata?.submissionDate || now;
  return {
    ...data,
    status,
    security: withDefaultSecurity(data.security),
    uploadedFiles: data.uploadedFiles || [],
    history:
      data.history && data.history.length > 0
        ? data.history
        : [
            {
              status,
              note: "تم إنشاء تذكرة طلب التمويل",
              updatedAt: submissionDate,
              actor: "system",
            },
          ],
    metadata: {
      submissionDate,
      lastUpdate: data.metadata?.lastUpdate || submissionDate,
      ...data.metadata,
    },
  };
}

export async function saveFinancingRequest(
  data: FinancingRequestRecord,
  preferredId?: string,
): Promise<string> {
  return saveRecord(
    "financing_request",
    withDefaultRequestStatus(data),
    preferredId,
  );
}

export async function getFinancingRequest(
  id: string,
): Promise<StoredFinancingRequest | null> {
  const record = await getRecord(id);
  if (!record || record.type !== "financing_request") return null;
  return {
    id: record.id,
    createdAt: record.createdAt,
    data: withDefaultRequestStatus(record.data),
  };
}

export async function listFinancingRequests(): Promise<
  StoredFinancingRequest[]
> {
  const records = await listRecordsByType("financing_request");
  return records.map((record) => ({
    id: record.id,
    createdAt: record.createdAt,
    data: withDefaultRequestStatus(record.data),
  }));
}

/**
 * Checks whether a short reference number is already used by a financing
 * request record — the only record type looked up by /inquiry — so two
 * different requests never collide on the same human-friendly number.
 */
export async function isFinancingRequestReferenceNumberTaken(
  referenceNumber: string,
): Promise<boolean> {
  const records = await listRecordsByType("financing_request");
  return records.some(
    (record: any) => record.data?.referenceNumber === referenceNumber,
  );
}

/**
 * Checks whether a short reference number is already used by any report or
 * financing request, to avoid two different records colliding on the same
 * human-friendly number (which would break inquiry/OTP lookups).
 */
export async function isReferenceNumberTaken(
  referenceNumber: string,
): Promise<boolean> {
  const [companyRecords, startupRecords, financingRecords] =
    await Promise.all([
      listRecordsByType("company"),
      listRecordsByType("startup"),
      listRecordsByType("financing_request"),
    ]);
  const all = [...companyRecords, ...startupRecords, ...financingRecords];
  return all.some((record: any) => record.data?.referenceNumber === referenceNumber);
}

/**
 * Generates a short reference number, retrying on collision with any
 * existing report/financing-request. Falls back to a random number after
 * several attempts to avoid an infinite loop.
 */
export async function generateUniqueReferenceNumber(): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const candidate = generateReferenceNumber();
    if (!(await isReferenceNumberTaken(candidate))) {
      return candidate;
    }
  }
  return generateReferenceNumber();
}

export async function getFinancingRequestByReferenceNumber(
  referenceNumber: string,
): Promise<StoredFinancingRequest | null> {
  const clean = String(referenceNumber || "").trim();
  if (!clean) return null;
  const records = await listFinancingRequests();
  return (
    records.find((record) => record.data.referenceNumber === clean) || null
  );
}

export async function updateFinancingRequestStatus(
  id: string,
  status: FinancingRequestStatus,
  note = "تم تحديث حالة الطلب",
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const updatedAt = new Date().toISOString();
  const refreshedLifecycle = current.data.lifecycle
    ? refreshFinancingLifecycleStatus(
        current.data.lifecycle,
        status,
        current.data.input,
        new Date(updatedAt),
      )
    : undefined;
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status,
    lifecycle: current.data.collateral
      ? syncLifecycleWithCollateral(refreshedLifecycle, current.data.collateral)
      : refreshedLifecycle,
    history: [
      ...(current.data.history || []),
      { status, note, updatedAt, actor: "bank" },
    ],
    metadata: {
      ...current.data.metadata,
      lastUpdate: updatedAt,
    },
  };
  const updated = await updateRecordData(
    id,
    "financing_request",
    updatedData,
  );
  return updated
    ? {
        id: updated.id,
        createdAt: updated.createdAt,
        data: withDefaultRequestStatus(updated.data),
      }
    : null;
}


export async function updateBankCreditReview(
  id: string,
  patch: Partial<BankCreditReview>,
  actor: { userId: string; name: string; role: BankRole },
  options?: { status?: FinancingRequestStatus; action?: string; details?: string },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const updatedAt = new Date().toISOString();
  const nextStatus = options?.status || current.data.status;
  const refreshedLifecycle = current.data.lifecycle
    ? refreshFinancingLifecycleStatus(
        current.data.lifecycle,
        nextStatus,
        current.data.input,
        new Date(updatedAt),
      )
    : undefined;
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: nextStatus,
    lifecycle: current.data.collateral
      ? syncLifecycleWithCollateral(refreshedLifecycle, current.data.collateral)
      : refreshedLifecycle,
    creditReview: { priority: "normal", ...(current.data.creditReview || {}), ...patch },
    auditTrail: [
      ...(current.data.auditTrail || []),
      {
        id: uuidv4(),
        action: options?.action || "credit_review_updated",
        actorId: actor.userId,
        actorName: actor.name,
        actorRole: actor.role,
        actorType: "bank",
        createdAt: updatedAt,
        details: options?.details || "تم تحديث المراجعة الائتمانية.",
      },
    ],
    history: options?.status
      ? [
          ...(current.data.history || []),
          {
            status: nextStatus,
            note: options.details || "تم تحديث القرار الائتماني.",
            updatedAt,
            actor: "bank",
            actorName: actor.name,
            actorRole: actor.role,
          },
        ]
      : current.data.history,
    metadata: { ...current.data.metadata, lastUpdate: updatedAt },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated
    ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) }
    : null;
}

export async function updateCollateralPackage(
  id: string,
  collateral: CollateralPackage,
  actor: { userId: string; name: string; role: BankRole },
  options?: { status?: FinancingRequestStatus; action?: string; details?: string },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const updatedAt = new Date().toISOString();
  const calculated = recalculateCollateralPackage(collateral, new Date(updatedAt));
  const nextStatus = options?.status || current.data.status;
  const baseLifecycle = current.data.lifecycle
    ? refreshFinancingLifecycleStatus(
        current.data.lifecycle,
        nextStatus,
        current.data.input,
        new Date(updatedAt),
      )
    : undefined;
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: nextStatus,
    collateral: calculated,
    lifecycle: syncLifecycleWithCollateral(baseLifecycle, calculated),
    auditTrail: [
      ...(current.data.auditTrail || []),
      {
        id: uuidv4(),
        action: options?.action || "collateral_package_updated",
        actorId: actor.userId,
        actorName: actor.name,
        actorRole: actor.role,
        actorType: "bank",
        createdAt: updatedAt,
        details: options?.details || "تم تحديث ملف الضمانات.",
      },
    ],
    history: options?.status
      ? [
          ...(current.data.history || []),
          {
            status: nextStatus,
            note: options.details || "تم تحديث حالة الضمانات.",
            updatedAt,
            actor: "bank",
            actorName: actor.name,
            actorRole: actor.role,
          },
        ]
      : current.data.history,
    metadata: { ...current.data.metadata, lastUpdate: updatedAt },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated
    ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) }
    : null;
}

export async function updateCollateralPackageByCompany(
  id: string,
  collateral: CollateralPackage,
  actor: {
    companyId?: string;
    name: string;
    accessMethod?: "company_session" | "otp_inquiry";
  },
  details = "تم تحديث مستندات الضمان من الشركة.",
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  if (
    actor.companyId &&
    current.data.ownerCompanyId !== actor.companyId
  )
    return null;
  if (!actor.companyId && actor.accessMethod !== "otp_inquiry") return null;
  const updatedAt = new Date().toISOString();
  const calculated = recalculateCollateralPackage(collateral, new Date(updatedAt));
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    collateral: calculated,
    lifecycle: syncLifecycleWithCollateral(current.data.lifecycle, calculated),
    auditTrail: [
      ...(current.data.auditTrail || []),
      {
        id: uuidv4(),
        action: "collateral_company_submission",
        actorId: actor.companyId || `inquiry:${id}`,
        actorName: actor.name,
        actorType: "company",
        createdAt: updatedAt,
        details,
      },
    ],
    history: [
      ...(current.data.history || []),
      {
        status: current.data.status,
        note: details,
        updatedAt,
        actor: "company",
        actorName: actor.name,
      },
    ],
    metadata: { ...current.data.metadata, lastUpdate: updatedAt },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated
    ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) }
    : null;
}


export async function activateMonitoringAfterDisbursement(
  id: string,
  actor: { userId: string; name: string; role: BankRole },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const collateral = current.data.collateral;
  if (!collateral || collateral.status !== "active" || !collateral.disbursementEligible) {
    throw new Error("لا يمكن بدء المتابعة قبل تفعيل حزمة الضمانات واكتمال أهلية الصرف.");
  }
  const approvedAmount = Math.max(
    0,
    Number(current.data.creditReview?.approvedAmount || current.data.lifecycle?.monitoringPlan.approvedAmount || 0),
  );
  if (!(approvedAmount > 0)) {
    throw new Error("لا يوجد مبلغ تمويل معتمد صالح لبدء المتابعة.");
  }
  const now = new Date();
  const updatedAt = now.toISOString();
  const nextSubmission = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 5)).toISOString();
  const nextStatus: FinancingRequestStatus = "monitoring";
  const baseLifecycle = current.data.lifecycle
    ? refreshFinancingLifecycleStatus(
        current.data.lifecycle,
        nextStatus,
        current.data.input,
        now,
      )
    : undefined;
  const lifecycle = baseLifecycle
    ? {
        ...baseLifecycle,
        monitoringPlan: {
          ...baseLifecycle.monitoringPlan,
          approvedAmount,
          disbursedAmount: approvedAmount,
          remainingUndisbursedAmount: 0,
          paymentStatus: "not_started" as const,
          latestFinancialUpdate: updatedAt,
          nextReviewDate: nextSubmission,
        },
      }
    : undefined;
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: nextStatus,
    lifecycle,
    monitoring: {
      cadence: current.data.monitoring?.cadence || "monthly",
      nextSubmissionDate: current.data.monitoring?.nextSubmissionDate || nextSubmission,
      snapshots: current.data.monitoring?.snapshots || [],
      actions: current.data.monitoring?.actions || [],
    },
    auditTrail: [
      ...(current.data.auditTrail || []),
      {
        id: uuidv4(),
        action: "financing_disbursed_monitoring_activated",
        actorId: actor.userId,
        actorName: actor.name,
        actorRole: actor.role,
        actorType: "bank",
        createdAt: updatedAt,
        details: `تم تأكيد صرف ${approvedAmount.toLocaleString("ar-SA")} ريال وبدء المتابعة الدورية بعد تفعيل الضمانات.`,
      },
    ],
    history: [
      ...(current.data.history || []),
      {
        status: nextStatus,
        note: "تم تأكيد الصرف وبدأ نظام المتابعة الاحترافية الشهرية.",
        updatedAt,
        actor: "bank",
        actorName: actor.name,
        actorRole: actor.role,
      },
    ],
    metadata: { ...current.data.metadata, lastUpdate: updatedAt },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated
    ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) }
    : null;
}

export async function addMonitoringSnapshot(
  id: string,
  snapshot: import("./types").MonitoringSnapshot,
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const snapshots = [...(current.data.monitoring?.snapshots || []), snapshot]
    .sort((a, b) => a.period.localeCompare(b.period));
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: snapshot.status === "default" ? "defaulted" : snapshot.status === "high_risk" ? "warning" : "monitoring",
    monitoring: {
      cadence: current.data.monitoring?.cadence || "monthly",
      nextSubmissionDate: nextMonthDate(snapshot.period),
      snapshots,
      actions: current.data.monitoring?.actions || [],
    },
    metadata: { ...current.data.metadata, lastUpdate: snapshot.submittedAt },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

function nextMonthDate(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 5));
  return date.toISOString();
}


function addMonthsIso(dateValue: string, months: number) {
  const date = new Date(dateValue);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function buildInstallmentSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  firstDueDate: string,
  existing: import("./types").FinancingInstallment[] = [],
): import("./types").FinancingInstallment[] {
  const paidBySequence = new Map(existing.map((item) => [item.sequence, item]));
  const monthlyRate = Math.max(0, annualRate) / 100 / 12;
  const payment = monthlyRate > 0
    ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths))
    : principal / termMonths;
  let balance = principal;
  return Array.from({ length: termMonths }, (_, index) => {
    const profit = monthlyRate > 0 ? balance * monthlyRate : 0;
    const principalPart = index === termMonths - 1 ? balance : Math.max(0, payment - profit);
    balance = Math.max(0, balance - principalPart);
    const old = paidBySequence.get(index + 1);
    const amountDue = Math.round((principalPart + profit) * 100) / 100;
    const paidAmount = Math.min(amountDue, Math.max(0, old?.paidAmount || 0));
    return {
      id: old?.id || uuidv4(),
      sequence: index + 1,
      dueDate: addMonthsIso(firstDueDate, index),
      principal: Math.round(principalPart * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      amountDue,
      paidAmount,
      paidAt: old?.paidAt,
      daysPastDue: old?.daysPastDue || 0,
      status: paidAmount >= amountDue ? "paid" : paidAmount > 0 ? "partial" : old?.status || "upcoming",
    };
  });
}

export async function recordFinancingDisbursement(
  id: string,
  input: Omit<import("./types").FinancingDisbursementRecord, "id" | "recordedAt" | "recordedBy">,
  actor: { userId: string; name: string; role: BankRole },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  if (!current.data.creditReview || current.data.creditReview.finalDecision !== "approved") {
    throw new Error("لا يمكن الصرف قبل الموافقة النهائية.");
  }
  if (!current.data.collateral?.disbursementEligible) {
    throw new Error("لا يمكن الصرف قبل اكتمال الضمانات وتفعيل أهليتها للصرف.");
  }
  const approvedAmount = Number(current.data.creditReview.approvedAmount || 0);
  const previous = current.data.operations?.disbursements || [];
  const totalBefore = previous.reduce((sum, item) => sum + item.amount, 0);
  const amount = Math.max(0, Number(input.amount || 0));
  if (!(amount > 0) || totalBefore + amount > approvedAmount + 0.01) {
    throw new Error("مبلغ الصرف غير صالح أو يتجاوز الرصيد المعتمد المتبقي.");
  }
  const now = new Date().toISOString();
  const disbursement = { ...input, id: uuidv4(), amount, recordedAt: now, recordedBy: actor.name };
  const totalDisbursed = totalBefore + amount;
  const term = Math.max(1, Number(current.data.creditReview.approvedTermMonths || current.data.input.termMonths || 12));
  const rate = Math.max(0, Number(current.data.creditReview.approvedRate || current.data.bankQuote.estimatedRate || 0));
  const firstDueDate = addMonthsIso(input.disbursementDate || now, 1);
  const installments = buildInstallmentSchedule(totalDisbursed, rate, term, firstDueDate, current.data.operations?.installments || []);
  const nextSubmission = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth() + 1, 5)).toISOString();
  const nextStatus: FinancingRequestStatus = "monitoring";
  const refreshedLifecycle = current.data.lifecycle
    ? refreshFinancingLifecycleStatus(current.data.lifecycle, nextStatus, current.data.input, new Date(now))
    : undefined;
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: nextStatus,
    lifecycle: refreshedLifecycle ? {
      ...refreshedLifecycle,
      monitoringPlan: {
        ...refreshedLifecycle.monitoringPlan,
        approvedAmount,
        disbursedAmount: totalDisbursed,
        remainingUndisbursedAmount: Math.max(0, approvedAmount - totalDisbursed),
        monthlyInstallment: installments[0]?.amountDue || 0,
        firstInstallmentDate: installments[0]?.dueDate || firstDueDate,
        lastInstallmentDate: installments.at(-1)?.dueDate || firstDueDate,
        remainingInstallments: installments.filter((item) => item.status !== "paid").length,
        paidInstallments: installments.filter((item) => item.status === "paid").length,
        paymentStatus: "not_started",
        latestFinancialUpdate: now,
        nextReviewDate: nextSubmission,
      },
    } : undefined,
    operations: {
      disbursements: [...previous, disbursement],
      totalDisbursed,
      remainingUndisbursed: Math.max(0, approvedAmount - totalDisbursed),
      installments,
      collectionEvents: current.data.operations?.collectionEvents || [],
      restructuringPlans: current.data.operations?.restructuringPlans || [],
      totalRecovered: current.data.operations?.totalRecovered || 0,
    },
    monitoring: current.data.monitoring || { cadence: "monthly", nextSubmissionDate: nextSubmission, snapshots: [], actions: [] },
    auditTrail: [...(current.data.auditTrail || []), { id: uuidv4(), action: "disbursement_recorded", actorId: actor.userId, actorName: actor.name, actorRole: actor.role, actorType: "bank", createdAt: now, details: `تم تسجيل صرف ${amount.toLocaleString("ar-SA")} ريال بمرجع ${input.transferReference}.` }],
    history: [...(current.data.history || []), { status: nextStatus, note: `تم تسجيل دفعة صرف بقيمة ${amount.toLocaleString("ar-SA")} ريال.`, updatedAt: now, actor: "bank", actorName: actor.name, actorRole: actor.role }],
    metadata: { ...current.data.metadata, lastUpdate: now },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function recordInstallmentPayment(
  id: string,
  installmentId: string,
  paidAmount: number,
  paidAt: string,
  daysPastDue: number,
  actor: { userId: string; name: string; role: BankRole },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const now = new Date().toISOString();
  let found = false;
  const installments = (current.data.operations?.installments || []).map((item) => {
    if (item.id !== installmentId) return item;
    found = true;
    const totalPaid = Math.min(item.amountDue, Math.max(0, item.paidAmount + paidAmount));
    const late = Math.max(0, Math.round(daysPastDue || 0));
    return { ...item, paidAmount: totalPaid, paidAt, daysPastDue: late, status: totalPaid >= item.amountDue ? "paid" as const : totalPaid > 0 ? "partial" as const : late > 0 ? "late" as const : item.status };
  });
  if (!found) throw new Error("القسط المحدد غير موجود.");
  const paidInstallments = installments.filter((item) => item.status === "paid").length;
  const maxLate = Math.max(0, ...installments.map((item) => item.daysPastDue));
  const paymentStatus = maxLate > 90 ? "defaulted" : maxLate > 30 ? "late_two_installments" : maxLate > 0 ? "late_one_installment" : "on_time";
  const nextStatus: FinancingRequestStatus = maxLate > 90 ? "defaulted" : maxLate > 0 ? "warning" : "monitoring";
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: nextStatus,
    operations: { ...(current.data.operations || { disbursements: [], totalDisbursed: 0, remainingUndisbursed: 0, installments: [], collectionEvents: [], restructuringPlans: [], totalRecovered: 0 }), installments },
    lifecycle: current.data.lifecycle ? { ...current.data.lifecycle, status: nextStatus, monitoringPlan: { ...current.data.lifecycle.monitoringPlan, paidInstallments, remainingInstallments: installments.length - paidInstallments, paymentStatus } } : undefined,
    auditTrail: [...(current.data.auditTrail || []), { id: uuidv4(), action: "installment_payment_recorded", actorId: actor.userId, actorName: actor.name, actorRole: actor.role, actorType: "bank", createdAt: now, details: `تم تسجيل سداد ${paidAmount.toLocaleString("ar-SA")} ريال.` }],
    metadata: { ...current.data.metadata, lastUpdate: now },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function addMonitoringSnapshotWithAudit(
  id: string,
  snapshot: import("./types").MonitoringSnapshot,
  actor: { userId: string; name: string; role: BankRole },
  sourceFile?: import("./types").FinancingRequestFile,
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const snapshots = [...(current.data.monitoring?.snapshots || []).filter((item) => item.period !== snapshot.period), snapshot].sort((a,b) => a.period.localeCompare(b.period));
  const nextStatus: FinancingRequestStatus = snapshot.status === "default" ? "defaulted" : snapshot.status === "high_risk" ? "warning" : "monitoring";
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    status: nextStatus,
    uploadedFiles: sourceFile ? [...(current.data.uploadedFiles || []), sourceFile] : current.data.uploadedFiles,
    monitoring: { cadence: current.data.monitoring?.cadence || "monthly", nextSubmissionDate: nextMonthDate(snapshot.period), snapshots, actions: current.data.monitoring?.actions || [] },
    auditTrail: [...(current.data.auditTrail || []), { id: uuidv4(), action: "monitoring_snapshot_added", actorId: actor.userId, actorName: actor.name, actorRole: actor.role, actorType: "bank", createdAt: snapshot.submittedAt, details: `تمت إضافة متابعة مالية للفترة ${snapshot.period} بحالة ${snapshot.status}.` }],
    history: [...(current.data.history || []), { status: nextStatus, note: `تم تحديث المتابعة المالية للفترة ${snapshot.period}.`, updatedAt: snapshot.submittedAt, actor: "bank", actorName: actor.name, actorRole: actor.role }],
    metadata: { ...current.data.metadata, lastUpdate: snapshot.submittedAt },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function addMonitoringAction(
  id: string,
  action: import("./types").MonitoringAction,
  actor: { userId: string; name: string; role: BankRole },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id); if (!current) return null;
  const now = new Date().toISOString();
  const updatedData: FinancingRequestRecord = { ...current.data, monitoring: { cadence: current.data.monitoring?.cadence || "monthly", nextSubmissionDate: current.data.monitoring?.nextSubmissionDate, snapshots: current.data.monitoring?.snapshots || [], actions: [...(current.data.monitoring?.actions || []), action] }, auditTrail: [...(current.data.auditTrail || []), { id: uuidv4(), action: "monitoring_action_added", actorId: actor.userId, actorName: actor.name, actorRole: actor.role, actorType: "bank", createdAt: now, details: action.title }], metadata: { ...current.data.metadata, lastUpdate: now } };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function recordCollectionEvent(
  id: string,
  event: Omit<import("./types").CollectionEvent, "id" | "createdAt" | "actorName">,
  actor: { userId: string; name: string; role: BankRole },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id); if (!current) return null;
  const now = new Date().toISOString();
  const item = { ...event, id: uuidv4(), createdAt: now, actorName: actor.name };
  const base = current.data.operations || { disbursements: [], totalDisbursed: 0, remainingUndisbursed: 0, installments: [], collectionEvents: [], restructuringPlans: [], totalRecovered: 0 };
  const recovered = event.type === "recovery" ? Math.max(0, Number(event.amount || 0)) : 0;
  let status = current.data.status;
  if (["collection_referral","legal_notice","collateral_enforcement","collateral_sale"].includes(event.type)) status = "defaulted";
  if (event.type === "closure") status = "closed";
  const collateral = event.type === "collateral_enforcement" && current.data.collateral ? { ...current.data.collateral, status: "enforcement" as const, enforcementEvents: [...current.data.collateral.enforcementEvents, { id: uuidv4(), createdAt: now, type: "notice" as const, amount: event.amount, note: event.note, actorName: actor.name }] } : current.data.collateral;
  const updatedData: FinancingRequestRecord = { ...current.data, status, collateral, operations: { ...base, collectionEvents: [...base.collectionEvents, item], totalRecovered: base.totalRecovered + recovered, closedAt: event.type === "closure" ? now : base.closedAt, closureReason: event.type === "closure" ? event.note : base.closureReason }, auditTrail: [...(current.data.auditTrail || []), { id: uuidv4(), action: `collection_${event.type}`, actorId: actor.userId, actorName: actor.name, actorRole: actor.role, actorType: "bank", createdAt: now, details: event.note }], history: [...(current.data.history || []), { status, note: event.note, updatedAt: now, actor: "bank", actorName: actor.name, actorRole: actor.role }], metadata: { ...current.data.metadata, lastUpdate: now } };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function recordRestructuringPlan(
  id: string,
  plan: Omit<import("./types").RestructuringPlan, "id" | "createdAt" | "actorName">,
  actor: { userId: string; name: string; role: BankRole },
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id); if (!current) return null;
  const now = new Date().toISOString();
  const item = { ...plan, id: uuidv4(), createdAt: now, actorName: actor.name };
  const base = current.data.operations || { disbursements: [], totalDisbursed: 0, remainingUndisbursed: 0, installments: [], collectionEvents: [], restructuringPlans: [], totalRecovered: 0 };
  const installments = plan.status === "approved" ? buildInstallmentSchedule(plan.newAmount, plan.newRate, plan.newTermMonths, addMonthsIso(now, Math.max(1, plan.gracePeriodMonths + 1)), base.installments) : base.installments;
  const updatedData: FinancingRequestRecord = { ...current.data, status: plan.status === "approved" ? "restructured" : current.data.status, operations: { ...base, installments, restructuringPlans: [...base.restructuringPlans, item] }, auditTrail: [...(current.data.auditTrail || []), { id: uuidv4(), action: "restructuring_plan_recorded", actorId: actor.userId, actorName: actor.name, actorRole: actor.role, actorType: "bank", createdAt: now, details: plan.reason }], history: [...(current.data.history || []), { status: plan.status === "approved" ? "restructured" : current.data.status, note: `تم تسجيل خطة إعادة جدولة: ${plan.reason}`, updatedAt: now, actor: "bank", actorName: actor.name, actorRole: actor.role }], metadata: { ...current.data.metadata, lastUpdate: now } };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function appendMonitoringDocumentByCompany(
  id: string,
  file: import("./types").FinancingRequestFile,
  actor: { companyId?: string; name: string; accessMethod?: "company_session" | "otp_inquiry" },
  period: string,
  note?: string,
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  if (actor.companyId && current.data.ownerCompanyId !== actor.companyId) return null;
  if (!actor.companyId && actor.accessMethod !== "otp_inquiry") return null;
  const now = new Date().toISOString();
  const action: import("./types").MonitoringAction = {
    id: uuidv4(),
    createdAt: now,
    title: `تم استلام القوائم المالية للفترة ${period}`,
    owner: actor.name,
    status: "completed",
    note: note || file.originalName,
  };
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    uploadedFiles: [...(current.data.uploadedFiles || []), file],
    monitoring: {
      cadence: current.data.monitoring?.cadence || "monthly",
      nextSubmissionDate: current.data.monitoring?.nextSubmissionDate,
      snapshots: current.data.monitoring?.snapshots || [],
      actions: [...(current.data.monitoring?.actions || []), action],
    },
    auditTrail: [...(current.data.auditTrail || []), {
      id: uuidv4(), action: "company_monitoring_statement_uploaded", actorId: actor.companyId || `inquiry:${id}`, actorName: actor.name, actorType: "company", createdAt: now, details: `رفعت الشركة قوائم الفترة ${period}: ${file.originalName}`
    }],
    history: [...(current.data.history || []), { status: current.data.status, note: `تم رفع القوائم المالية للفترة ${period}.`, updatedAt: now, actor: "company", actorName: actor.name }],
    metadata: { ...current.data.metadata, lastUpdate: now },
  };
  const updated = await updateRecordData(id, "financing_request", updatedData);
  return updated ? { id: updated.id, createdAt: updated.createdAt, data: withDefaultRequestStatus(updated.data) } : null;
}

export async function updateFinancingRequestSecurity(
  id: string,
  security: TicketSecurity,
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    security,
  };
  const updated = await updateRecordData(
    id,
    "financing_request",
    updatedData,
  );
  return updated
    ? {
        id: updated.id,
        createdAt: updated.createdAt,
        data: withDefaultRequestStatus(updated.data),
      }
    : null;
}

export type InquiryOtpVerificationResult =
  | { status: "ok"; request: StoredFinancingRequest }
  | { status: "not_found" | "expired" | "locked" | "invalid" };

export async function verifyFinancingRequestOtpAttempt(
  id: string,
  otp: string,
  now = new Date(),
): Promise<InquiryOtpVerificationResult> {
  assertStorageConfiguration();

  if (USE_POSTGRES) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, type, created_at, data FROM reports
         WHERE id = $1 AND type = 'financing_request' FOR UPDATE`,
        [id],
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return { status: "not_found" };
      }
      const record = normalizeRow<"financing_request">(row);
      const evaluated = evaluateOtpAttempt(record, otp, now);
      if (evaluated.changed) {
        await client.query(
          `UPDATE reports SET data = $1 WHERE id = $2 AND type = 'financing_request'`,
          [JSON.stringify(evaluated.record.data), id],
        );
      }
      await client.query("COMMIT");
      return evaluated.result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return withFileWriteLock(async () => {
    const db = await getFileDb();
    const raw = db.data.reports[id];
    if (!raw || raw.type !== "financing_request") {
      return { status: "not_found" };
    }
    const record = raw as GenericRecord<"financing_request">;
    const evaluated = evaluateOtpAttempt(record, otp, now);
    if (evaluated.changed) {
      db.data.reports[id] = evaluated.record;
      await db.write();
    }
    return evaluated.result;
  });
}

function evaluateOtpAttempt(
  record: GenericRecord<"financing_request">,
  otp: string,
  now: Date,
): {
  record: GenericRecord<"financing_request">;
  changed: boolean;
  result: InquiryOtpVerificationResult;
} {
  const data = withDefaultRequestStatus(record.data);
  const security = data.security;
  const normalizedRecord: GenericRecord<"financing_request"> = {
    ...record,
    data,
  };

  if (!security) {
    return {
      record: normalizedRecord,
      changed: false,
      result: { status: "not_found" },
    };
  }
  if (security.otpAttemptCount >= security.otpMaxAttempts) {
    return {
      record: normalizedRecord,
      changed: false,
      result: { status: "locked" },
    };
  }
  if (new Date(security.otpExpiresAt).getTime() <= now.getTime()) {
    return {
      record: normalizedRecord,
      changed: false,
      result: { status: "expired" },
    };
  }

  if (!verifyOtp(otp, security.otpSalt, security.otpHash)) {
    normalizedRecord.data = {
      ...data,
      security: {
        ...security,
        otpAttemptCount: security.otpAttemptCount + 1,
      },
    };
    return {
      record: normalizedRecord,
      changed: true,
      result: { status: "invalid" },
    };
  }

  normalizedRecord.data = {
    ...data,
    security: security.otpVerifiedAt
      ? security
      : { ...security, otpVerifiedAt: now.toISOString() },
  };
  return {
    record: normalizedRecord,
    changed: !security.otpVerifiedAt,
    result: {
      status: "ok",
      request: {
        id: normalizedRecord.id,
        createdAt: normalizedRecord.createdAt,
        data: normalizedRecord.data,
      },
    },
  };
}

export async function updateFinancingRequestEmailDelivery(
  id: string,
  emailDelivery: NonNullable<
    FinancingRequestRecord["metadata"]
  >["emailDelivery"],
): Promise<StoredFinancingRequest | null> {
  const current = await getFinancingRequest(id);
  if (!current) return null;
  const updatedAt = new Date().toISOString();
  const updatedData: FinancingRequestRecord = {
    ...current.data,
    metadata: {
      ...current.data.metadata,
      emailDelivery,
      lastUpdate: updatedAt,
    },
  };
  const updated = await updateRecordData(
    id,
    "financing_request",
    updatedData,
  );
  return updated
    ? {
        id: updated.id,
        createdAt: updated.createdAt,
        data: withDefaultRequestStatus(updated.data),
      }
    : null;
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCR(crNumber: string) {
  return crNumber.trim();
}

function buildBankUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role?: import("./types").BankRole;
  department?: string;
}): BankUser {
  return {
    id: uuidv4(),
    email: normalizeEmail(input.email),
    name: input.name.trim(),
    passwordHash: input.passwordHash,
    role: input.role || "credit_analyst",
    department: input.department || "إدارة الائتمان",
    isActive: true,
    mfaEnabled: false,
    createdAt: new Date().toISOString(),
  };
}

export async function createBankUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role?: import("./types").BankRole;
  department?: string;
}): Promise<BankUser> {
  const user = buildBankUser(input);
  if (USE_POSTGRES) {
    await saveRecord("bank_user", user);
    return user;
  }

  return withFileWriteLock(async () => {
    const db = await getFileDb();
    const duplicate = Object.values(db.data.reports).some(
      (record) =>
        record.type === "bank_user" &&
        normalizeEmail(record.data.email) === user.email,
    );
    if (duplicate) throw duplicateRecordError("bank user email");
    const recordId = uuidv4();
    db.data.reports[recordId] = {
      id: recordId,
      type: "bank_user",
      createdAt: new Date().toISOString(),
      data: user,
    };
    await db.write();
    return user;
  });
}

export async function createInitialBankUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role?: import("./types").BankRole;
  department?: string;
}): Promise<BankUser | null> {
  assertStorageConfiguration();
  const user = buildBankUser({ ...input, role: "admin", department: input.department || "إدارة الائتمان والمخاطر" });

  if (USE_POSTGRES) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('financial_pulse_initial_bank_user'))",
      );
      const count = await client.query(
        `SELECT 1 FROM reports WHERE type = 'bank_user' LIMIT 1`,
      );
      if (count.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `INSERT INTO reports (id, type, created_at, data) VALUES ($1, 'bank_user', $2, $3)`,
        [uuidv4(), new Date().toISOString(), JSON.stringify(user)],
      );
      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return withFileWriteLock(async () => {
    const db = await getFileDb();
    if (
      Object.values(db.data.reports).some(
        (record) => record.type === "bank_user",
      )
    ) {
      return null;
    }
    const recordId = uuidv4();
    db.data.reports[recordId] = {
      id: recordId,
      type: "bank_user",
      createdAt: new Date().toISOString(),
      data: user,
    };
    await db.write();
    return user;
  });
}

export async function getBankUserByEmail(
  email: string,
): Promise<BankUser | null> {
  const target = normalizeEmail(email);
  const records = await listRecordsByType("bank_user");
  const found = records.find(
    (record) => normalizeEmail(record.data.email || "") === target,
  );
  return found?.data || null;
}

export async function countBankUsers(): Promise<number> {
  return (await listRecordsByType("bank_user")).length;
}

export async function createCompanyUser(input: {
  crNumber: string;
  companyName: string;
  sector: string;
  detailedActivity?: string;
  establishmentDate?: string;
  companyAgeYears?: number;
  city: string;
  phone: string;
  email: string;
  passwordHash: string;
}): Promise<CompanyUser> {
  const user: CompanyUser = {
    id: uuidv4(),
    crNumber: normalizeCR(input.crNumber),
    companyName: input.companyName.trim(),
    sector: input.sector || "",
    detailedActivity: input.detailedActivity?.trim() || "",
    establishmentDate: input.establishmentDate || undefined,
    companyAgeYears: Math.max(0, Number(input.companyAgeYears || 0)),
    city: input.city || "",
    phone: input.phone.trim(),
    email: input.email ? normalizeEmail(input.email) : "",
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
  };
  if (USE_POSTGRES) {
    await saveRecord("company_user", user);
    return user;
  }

  return withFileWriteLock(async () => {
    const db = await getFileDb();
    const duplicate = Object.values(db.data.reports).some((record) => {
      if (record.type !== "company_user") return false;
      return (
        normalizeCR(record.data.crNumber) === user.crNumber ||
        Boolean(user.email && normalizeEmail(record.data.email) === user.email)
      );
    });
    if (duplicate) throw duplicateRecordError("company registration/email");
    const recordId = uuidv4();
    db.data.reports[recordId] = {
      id: recordId,
      type: "company_user",
      createdAt: new Date().toISOString(),
      data: user,
    };
    await db.write();
    return user;
  });
}

export async function getCompanyUserByCR(
  crNumber: string,
): Promise<CompanyUser | null> {
  const target = normalizeCR(crNumber);
  const records = await listRecordsByType("company_user");
  const found = records.find(
    (record) => normalizeCR(record.data.crNumber || "") === target,
  );
  return found?.data || null;
}

function duplicateRecordError(field: string) {
  const error = new Error(`Duplicate record: ${field}`) as Error & {
    code?: string;
  };
  error.code = "23505";
  return error;
}

/* ------------------------------------------------------------------ *
 * Durable file/outbox records used in serverless/Postgres deployments
 * ------------------------------------------------------------------ */

export async function saveFileBlob(data: StoredFileBlob): Promise<string> {
  return saveRecord("file_blob", data);
}

export async function getFileBlob(id: string): Promise<StoredFileBlob | null> {
  const record = await getRecord(id);
  return record?.type === "file_blob" ? record.data : null;
}

export async function saveOutboxEmail(
  data: StoredOutboxEmail,
): Promise<string> {
  return saveRecord("outbox_email", data);
}
