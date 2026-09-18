import { NextRequest, NextResponse } from "next/server";
import { toProjectId } from "@/lib/ai-video-director";
import { getProject, unlockProject } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json() as { projectId?: unknown };
  const projectId = toProjectId(body.projectId);
  if (!projectId) return NextResponse.json({ error: "Некорректный проект" }, { status: 400 });
  if (!await getProject(projectId)) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  const result = await unlockProject(projectId);
  return result.ok ? NextResponse.json({ ok: true, paymentId: result.paymentId }) : NextResponse.json({ error: "Не удалось открыть production pack" }, { status: 500 });
}
