// Persistence layer with two modes:
//
// 1. Local JSON file (default) — zero setup, used automatically when no
//    DATABASE_URL is set. Perfect for `npm run dev` on your own machine.
//
// 2. PostgreSQL (when DATABASE_URL is set) — required for any real
//    deployment (Vercel, Railway, etc.), since those platforms don't
//    guarantee the local filesystem persists between requests. Run
//    database/reports-table.sql once against your Postgres instance to
//    create the table this mode uses.
//
// The rest of the app (API routes) never needs to know which mode is
// active — both saveReport()/getReport() have identical signatures.

import { v4 as uuidv4 } from "uuid";
import {
  StoredReport,
  ReportType,
  CompanyReportData,
  StartupReportData,
} from "./types";

const USE_POSTGRES = !!process.env.DATABASE_URL;

/* ------------------------------------------------------------------ *
 * Postgres mode
 * ------------------------------------------------------------------ */

async function savePostgres(
  type: ReportType,
  data: CompanyReportData | StartupReportData
): Promise<string> {
  const pool = getPool();
  const id = uuidv4();
  await pool.query(
    `INSERT INTO reports (id, type, created_at, data) VALUES ($1, $2, $3, $4)`,
    [id, type, new Date().toISOString(), JSON.stringify(data)]
  );
  return id;
}

async function getPostgres(id: string): Promise<StoredReport | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, type, created_at, data FROM reports WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    data: row.data,
  };
}

let poolInstance: import("pg").Pool | null = null;
function getPool(): import("pg").Pool {
  if (!poolInstance) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg");
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required by most managed Postgres hosts
    });
  }
  return poolInstance;
}

/* ------------------------------------------------------------------ *
 * Local JSON file mode
 * ------------------------------------------------------------------ */

interface DBSchema {
  reports: Record<string, StoredReport>;
}

let dbPromise: Promise<any> | null = null;

async function getFileDb() {
  if (!dbPromise) {
    const { JSONFilePreset } = await import("lowdb/node");
    const path = await import("path");
    const DB_PATH = path.join(process.cwd(), "data", "db.json");
    dbPromise = JSONFilePreset<DBSchema>(DB_PATH, { reports: {} });
  }
  return dbPromise;
}

async function saveFile(
  type: ReportType,
  data: CompanyReportData | StartupReportData
): Promise<string> {
  const db = await getFileDb();
  const id = uuidv4();
  const report: StoredReport = {
    id,
    type,
    createdAt: new Date().toISOString(),
    data,
  };
  db.data.reports[id] = report;
  await db.write();
  return id;
}

async function getFile(id: string): Promise<StoredReport | null> {
  const db = await getFileDb();
  return db.data.reports[id] ?? null;
}

/* ------------------------------------------------------------------ *
 * Public API — routes to whichever mode is active
 * ------------------------------------------------------------------ */

export async function saveReport(
  type: ReportType,
  data: CompanyReportData | StartupReportData
): Promise<string> {
  return USE_POSTGRES ? savePostgres(type, data) : saveFile(type, data);
}

export async function getReport(id: string): Promise<StoredReport | null> {
  return USE_POSTGRES ? getPostgres(id) : getFile(id);
}
