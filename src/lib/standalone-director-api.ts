import type { NextRequest } from "next/server";
import { getProject, saveProject } from "@/lib/store";
import { generateVideoDirectorStoryboard, getProjectTotalScenes, getVideoDirectorSceneCount, serializeVideoDirectorProject, type VideoDirectorProject, type VideoDirectorScene } from "@/lib/ai-video-director";

export function userId(req: NextRequest): string {
  return req.headers.get("x-director-user")?.trim().slice(0, 120) || "local-demo";
}

export function projectResponse(project: VideoDirectorProject, unlocked: boolean) {
  return serializeVideoDirectorProject(project, unlocked);
}

export async function ensureFullProject(project: VideoDirectorProject): Promise<VideoDirectorProject> {
  if (project.scenes.length >= getProjectTotalScenes(project)) return project;
  const scenes = await generateVideoDirectorStoryboard(project.input, project.analysis, project.selectedIdea);
  const complete = { ...project, scenes, totalScenes: getVideoDirectorSceneCount(project.input) };
  await saveProject(complete, (await getProject(project.projectId))?.userId || "local-demo");
  return complete;
}

export function cleanSceneText(value: unknown, fallback: string, max: number): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, max);
}

export function coerceEditableScenes(rawScenes: unknown, existingScenes: VideoDirectorScene[], durationSec: number): VideoDirectorScene[] {
  if (!Array.isArray(rawScenes)) throw new Error("Некорректные сцены");
  if (rawScenes.length !== existingScenes.length) throw new Error("Количество сцен изменилось, обновите проект и попробуйте снова");
  return rawScenes.map((raw, index) => {
    const item = typeof raw === "object" && raw ? raw as Record<string, unknown> : {};
    const fallback = existingScenes[index];
    const startSec = index * 10;
    return {
      id: index + 1,
      startSec,
      endSec: Math.min(Math.max(durationSec, startSec + 1), startSec + 10),
      label: cleanSceneText(item.label, fallback.label, 80),
      purpose: cleanSceneText(item.purpose, fallback.purpose, 280),
      visual: cleanSceneText(item.visual, fallback.visual, 900),
      camera: cleanSceneText(item.camera, fallback.camera, 360),
      lighting: cleanSceneText(item.lighting, fallback.lighting, 360),
      action: cleanSceneText(item.action, fallback.action, 700),
      prompt: cleanSceneText(item.prompt, fallback.prompt, 2400),
      negativePrompt: cleanSceneText(item.negativePrompt, fallback.negativePrompt, 1000),
    };
  });
}
