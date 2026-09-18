import { NextRequest, NextResponse } from "next/server";
import { toProjectId } from "@/lib/ai-video-director";
import { ensureFullProject, projectResponse } from "@/lib/standalone-director-api";
import { getProject } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { projectId?: unknown; paymentId?: unknown };
    const projectId = toProjectId(body.projectId);
    if (!projectId) return NextResponse.json({ error: "Некорректный проект" }, { status: 400 });
    const stored = await getProject(projectId);
    if (!stored) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
    if (!stored.unlocked && paymentId !== stored.paymentId) return NextResponse.json({ error: "Нужно открыть полный сценарий" }, { status: 403 });
    const complete = await ensureFullProject(stored);
    return NextResponse.json({ ...projectResponse(complete, true), paymentId: stored.paymentId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось открыть сценарий" }, { status: 500 });
  }
}
