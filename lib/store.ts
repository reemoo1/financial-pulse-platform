// Demo persistence layer using a local JSON file via lowdb.
//
// This keeps the project runnable with zero setup (no database server
// required). For production use with a real Saudi bank deployment, wire
// these same function signatures to PostgreSQL using the schema in
// database/schema.sql — see the commented example at the bottom of this
// file for the query shapes you'd use with the `pg` package.

import { JSONFilePreset } from "lowdb/node";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import {
  StoredReport,
  ReportType,
  CompanyReportData,
  StartupReportData,
} from "./types";

interface DBSchema {
  reports: Record<string, StoredReport>;
}

const DB_PATH = path.join(process.cwd(), "data", "db.json");

let dbPromise: Promise<Awaited<ReturnType<typeof JSONFilePreset<DBSchema>>>> | null =
  null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = JSONFilePreset<DBSchema>(DB_PATH, { reports: {} });
  }
  return dbPromise;
}

export async function saveReport(
  type: ReportType,
  data: CompanyReportData | StartupReportData
): Promise<string> {
  const db = await getDb();
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

export async function getReport(id: string): Promise<StoredReport | null> {
  const db = await getDb();
  return db.data.reports[id] ?? null;
}

/* ------------------------------------------------------------------ *
 * Production PostgreSQL reference (not active — uncomment & adapt):
 *
 * import { Pool } from "pg";
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *
 * export async function saveReport(type, data) {
 *   const result = await pool.query(
 *     `INSERT INTO reports (company_id, startup_project_id, ai_summary_text)
 *      VALUES ($1, $2, $3) RETURNING id`,
 *     [data.companyId ?? null, data.startupProjectId ?? null, data.narrative]
 *   );
 *   return result.rows[0].id;
 * }
 *
 * export async function getReport(id) {
 *   const result = await pool.query(`SELECT * FROM reports WHERE id = $1`, [id]);
 *   return result.rows[0] ?? null;
 * }
 * ------------------------------------------------------------------ */
