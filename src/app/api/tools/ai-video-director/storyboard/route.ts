import { NextRequest, NextResponse } from "next/server";
import { generateVideoDirectorStoryboard, getVideoDirectorSceneCount, makeVideoDirectorProject, normalizeIdeaId, serializeVideoDirectorProject } from "@/lib/ai-video-director";
import { getDraft, saveProject } from "@/lib/store";
import { userId } from "@/lib/standalone-director-api";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { sessionId?: unknown; selectedIdeaId?: unknown };
    const sessionId = String(body.sessionId || "").trim();
    const selectedIdeaId = normalizeIdeaId(body.selectedIdeaId);
    if (!/^[a-z0-9-]{8,80}$/i.test(sessionId)) return NextResponse.json({ error: "Некорректная сессия" }, { status: 400 });
    const draft = await getDraft(sessionId);
    if (!draft) return NextResponse.json({ error: "Идеи не найдены, сгенерируйте их заново" }, { status: 404 });
    const selectedIdea = draft.ideas.find((idea) => idea.id === selectedIdeaId) || draft.ideas[0];
    if (!selectedIdea) return NextResponse.json({ error: "Выберите концепцию" }, { status: 400 });
    const scenes = await generateVideoDirectorStoryboard(draft.input, draft.analysis, selectedIdea, { sceneLimit: Math.min(2, getVideoDirectorSceneCount(draft.input)) });
    const project = makeVideoDirectorProject(draft.input, draft.analysis, draft.ideas, selectedIdea, scenes);
    await saveProject(project, userId(req));
    return NextResponse.json(serializeVideoDirectorProject(project, false));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось создать раскадровку" }, { status: 500 });
  }
}
