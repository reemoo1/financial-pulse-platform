import { NextResponse } from "next/server";
import { countBankUsers } from "@/lib/store";

export async function GET() {
  const count = await countBankUsers();
  return NextResponse.json(
    { hasUsers: count > 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
