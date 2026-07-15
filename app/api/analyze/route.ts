import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function runPythonPipeline(filePath: string) {
  const pythonCandidates = [process.env.PYTHON_BIN, "python", "python3"].filter(
    Boolean
  ) as string[];

  let lastError: unknown;

  for (const pythonBin of pythonCandidates) {
    try {
      const { stdout, stderr } = await execFileAsync(
        pythonBin,
        ["-m", "src.elt.pipeline", filePath],
        {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10,
        }
      );

      if (stderr && stderr.trim()) {
        console.error("Python stderr:", stderr);
      }

      return stdout;
    } catch (error: any) {
      lastError = error;
      const code = error?.code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("لم يتم العثور على Python. جرّب ضبط PYTHON_BIN أو تثبيت python/python3.");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "لم يتم رفع أي ملف." },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
    const filePath = path.join(uploadsDir, safeName);

    await fs.writeFile(filePath, buffer);

    const stdout = await runPythonPipeline(filePath);

    try {
      return NextResponse.json(JSON.parse(stdout));
    } catch {
      return NextResponse.json(
        {
          error: "تعذر قراءة نتيجة بايثون.",
          raw_output: stdout,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "حدث خطأ أثناء تحليل الملف.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
