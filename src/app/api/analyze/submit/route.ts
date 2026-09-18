import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export async function POST() {
  return NextResponse.json({ task_id: randomUUID() });
}
