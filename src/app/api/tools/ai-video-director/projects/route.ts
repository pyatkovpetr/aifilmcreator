import { NextRequest, NextResponse } from "next/server";
import { getProject, listProjects, updateScenes } from "@/lib/store";
import { getProjectTotalScenes, serializeVideoDirectorProject, toProjectId, VIDEO_DIRECTOR_SEGMENT_SECONDS } from "@/lib/ai-video-director";
import { coerceEditableScenes, ensureFullProject, userId } from "@/lib/standalone-director-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const projectId = toProjectId(req.nextUrl.searchParams.get("projectId"));
    if (projectId) {
      const project = await getProject(projectId);
      if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
      const unlocked = project.unlocked;
      const complete = unlocked ? await ensureFullProject(project) : project;
      return NextResponse.json({ ...serializeVideoDirectorProject(complete, unlocked), paymentId: project.paymentId });
    }
    const items = (await listProjects(userId(req))).map((project) => ({
      projectId: project.projectId,
      title: project.input.title || project.selectedIdea.title || "AI режиссёр",
      mode: project.input.mode,
      selectedIdeaTitle: project.selectedIdea.title,
      scenesReady: project.scenes.length,
      totalScenes: getProjectTotalScenes(project),
      complete: project.unlocked && project.scenes.length >= getProjectTotalScenes(project),
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
    }));
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить проекты" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { projectId?: unknown; scenes?: unknown };
    const projectId = toProjectId(body.projectId);
    if (!projectId) return NextResponse.json({ error: "Некорректный проект" }, { status: 400 });
    const project = await getProject(projectId);
    if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    if (!project.unlocked) return NextResponse.json({ error: "Нужно открыть production pack" }, { status: 403 });
    const complete = await ensureFullProject(project);
    const scenes = coerceEditableScenes(body.scenes, complete.scenes, complete.input.durationSec);
    const saved = await updateScenes(projectId, scenes);
    if (!saved) return NextResponse.json({ error: "Не удалось сохранить проект" }, { status: 500 });
    return NextResponse.json({ ...serializeVideoDirectorProject(saved, true), paymentId: saved.paymentId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить проект";
    return NextResponse.json({ error: message }, { status: /Количество сцен|Некорректные сцены/.test(message) ? 400 : 500 });
  }
}
