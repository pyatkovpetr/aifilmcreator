import { NextRequest, NextResponse } from "next/server";
import { toProjectId } from "@/lib/ai-video-director";
import { generateVideoDirectorPdf } from "@/lib/ai-video-director-pdf";
import { ensureFullProject } from "@/lib/standalone-director-api";
import { getProject } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { projectId?: unknown };
    const projectId = toProjectId(body.projectId);
    if (!projectId) return NextResponse.json({ error: "Некорректный проект" }, { status: 400 });
    const stored = await getProject(projectId);
    if (!stored) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    if (!stored.unlocked) return NextResponse.json({ error: "Нужно разблокировать PDF" }, { status: 403 });
    const project = await ensureFullProject(stored);
    const buffer = generateVideoDirectorPdf(project);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ai_video_director_${projectId.slice(0, 8)}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать PDF" }, { status: 500 });
  }
}
