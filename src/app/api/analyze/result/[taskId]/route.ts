import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "completed", result: { bpm: 120, mode: "major" } });
}
