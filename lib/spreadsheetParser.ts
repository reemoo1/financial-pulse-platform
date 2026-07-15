import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

const MAX_UNCOMPRESSED_BYTES = 24 * 1024 * 1024;
const MAX_XML_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_ROWS = 5_000;
const MAX_COLUMNS = 200;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: false,
  allowBooleanAttributes: false,
});

export type SpreadsheetExtension = ".xlsx" | ".csv";

/**
 * Parses the first worksheet into a two-dimensional row array.
 * Only modern macro-free XLSX and CSV are accepted. Legacy XLS is intentionally
 * rejected because it requires a broader binary parser and increases attack surface.
 */
export function parseSpreadsheetRows(
  bytes: Uint8Array,
  extension: SpreadsheetExtension,
): unknown[][] {
  if (extension === ".csv") return parseCsvRows(bytes);
  return parseXlsxRows(bytes);
}

function parseCsvRows(bytes: Uint8Array): unknown[][] {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const rows = parseCsv(text, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: false,
    max_record_size: 1024 * 1024,
  }) as unknown[][];

  assertSheetDimensions(rows);
  return rows;
}

function parseXlsxRows(bytes: Uint8Array): unknown[][] {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("ملف XLSX غير صالح أو لا يحمل توقيع ZIP الصحيح.");
  }

  let expandedBytes = 0;
  const archive = unzipSync(bytes, {
    filter(file) {
      if (file.originalSize > MAX_XML_ENTRY_BYTES) {
        throw new Error("أحد أجزاء ملف XLSX أكبر من الحد الآمن.");
      }
      expandedBytes += file.originalSize;
      if (expandedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("تم رفض ملف XLSX بسبب حجم فك الضغط غير الآمن.");
      }
      return isAllowedWorkbookEntry(file.name);
    },
  });

  const workbook = parseXmlEntry(archive, "xl/workbook.xml");
  const rels = parseXmlEntry(archive, "xl/_rels/workbook.xml.rels");
  const sharedStrings = readSharedStrings(archive);
  const firstSheetPath = resolveFirstSheetPath(workbook, rels, archive);
  const sheet = parseXmlEntry(archive, firstSheetPath);
  const rows = readWorksheetRows(sheet, sharedStrings);
  assertSheetDimensions(rows);
  return rows;
}

function isAllowedWorkbookEntry(name: string): boolean {
  const normalized = name.replace(/\\/g, "/");
  return (
    normalized === "xl/workbook.xml" ||
    normalized === "xl/_rels/workbook.xml.rels" ||
    normalized === "xl/sharedStrings.xml" ||
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(normalized)
  );
}

function parseXmlEntry(archive: Record<string, Uint8Array>, name: string): any {
  const entry = archive[name];
  if (!entry) throw new Error("ملف XLSX لا يحتوي على بنية مصنف صحيحة.");
  return xmlParser.parse(strFromU8(entry));
}

function readSharedStrings(archive: Record<string, Uint8Array>): string[] {
  const entry = archive["xl/sharedStrings.xml"];
  if (!entry) return [];
  const parsed = xmlParser.parse(strFromU8(entry));
  return asArray(parsed?.sst?.si).map(readRichText);
}

function readRichText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value.t != null) return readTextNode(value.t);
  return asArray(value.r)
    .map((part) => readTextNode(part?.t))
    .join("");
}

function readTextNode(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return String(value["#text"] ?? "");
}

function resolveFirstSheetPath(
  workbook: any,
  rels: any,
  archive: Record<string, Uint8Array>,
): string {
  const firstSheet = asArray(workbook?.workbook?.sheets?.sheet)[0];
  const relationId = firstSheet?.id;
  const relations = asArray(rels?.Relationships?.Relationship);
  const target = relations.find((relation) => relation?.Id === relationId)?.Target;

  if (typeof target === "string" && target.trim()) {
    const normalizedTarget = target.replace(/\\/g, "/").replace(/^\/+/, "");
    const resolved = normalizedTarget.startsWith("xl/")
      ? path.posix.normalize(normalizedTarget)
      : path.posix.normalize(`xl/${normalizedTarget}`);
    if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(resolved) && archive[resolved]) {
      return resolved;
    }
  }

  const fallback = Object.keys(archive)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "en"))[0];
  if (!fallback) throw new Error("ملف XLSX لا يحتوي على ورقة عمل قابلة للقراءة.");
  return fallback;
}

function readWorksheetRows(sheet: any, sharedStrings: string[]): unknown[][] {
  const output: unknown[][] = [];
  const rows = asArray(sheet?.worksheet?.sheetData?.row);
  if (rows.length > MAX_ROWS) throw new Error(`عدد الصفوف يتجاوز الحد الآمن (${MAX_ROWS}).`);

  for (const row of rows) {
    const values: unknown[] = [];
    const cells = asArray(row?.c);
    for (const cell of cells) {
      const index = columnIndex(cell?.r);
      if (index >= MAX_COLUMNS) {
        throw new Error(`عدد الأعمدة يتجاوز الحد الآمن (${MAX_COLUMNS}).`);
      }
      values[index] = readCellValue(cell, sharedStrings);
    }
    output.push(values);
  }
  return output;
}

function readCellValue(cell: any, sharedStrings: string[]): unknown {
  const type = String(cell?.t ?? "");
  if (type === "inlineStr") return readRichText(cell?.is);

  const raw = readTextNode(cell?.v);
  if (type === "s") {
    const index = Number(raw);
    return Number.isInteger(index) && index >= 0 ? sharedStrings[index] ?? "" : "";
  }
  if (type === "str" || type === "e") return raw;
  if (type === "b") return raw === "1";
  if (raw === "") return null;

  const numberValue = Number(raw);
  return Number.isFinite(numberValue) ? numberValue : raw;
}

function columnIndex(reference: unknown): number {
  const letters = String(reference ?? "A1").match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

function assertSheetDimensions(rows: unknown[][]): void {
  if (rows.length === 0) throw new Error("الملف لا يحتوي على بيانات قابلة للقراءة.");
  if (rows.length > MAX_ROWS) throw new Error(`عدد الصفوف يتجاوز الحد الآمن (${MAX_ROWS}).`);
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxColumns > MAX_COLUMNS) {
    throw new Error(`عدد الأعمدة يتجاوز الحد الآمن (${MAX_COLUMNS}).`);
  }
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
