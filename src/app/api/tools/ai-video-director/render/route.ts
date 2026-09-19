import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { toProjectId } from "@/lib/ai-video-director";
import { ensureFullProject } from "@/lib/standalone-director-api";
import { getProject } from "@/lib/store";
import { TTS_VOICES } from "@/lib/tts-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function dataDir() {
  return process.env.AI_DIRECTOR_DATA_DIR || join(process.cwd(), ".data");
}

function jobDir(jobId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) throw new Error("Некорректный jobId");
  return join(dataDir(), "renders", jobId);
}

async function readJob(jobId: string) {
  return JSON.parse(await readFile(join(jobDir(jobId), "status.json"), "utf8")) as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { projectId?: unknown; paymentId?: unknown; voiceover?: { text?: unknown; voice?: unknown; instructions?: unknown } };
    const projectId = toProjectId(body.projectId);
    if (!projectId) return NextResponse.json({ error: "Некорректный проект" }, { status: 400 });
    const stored = await getProject(projectId);
    if (!stored) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
    if (!stored.unlocked && paymentId !== stored.paymentId) return NextResponse.json({ error: "Нужно открыть полный сценарий" }, { status: 403 });
    const voiceoverText = typeof body.voiceover?.text === "string" ? body.voiceover.text.trim() : "";
    if (voiceoverText.length > 5000) return NextResponse.json({ error: "Озвучка: максимум 5000 символов" }, { status: 400 });
    const voice = typeof body.voiceover?.voice === "string" ? body.voiceover.voice : "serena";
    if (voiceoverText && !TTS_VOICES.includes(voice as typeof TTS_VOICES[number])) return NextResponse.json({ error: "Неизвестный голос" }, { status: 400 });
    const instructions = typeof body.voiceover?.instructions === "string" ? body.voiceover.instructions.trim().slice(0, 300) : "";
    const project = await ensureFullProject(stored);
    const jobId = `${projectId}-${Date.now()}`;
    const directory = jobDir(jobId);
    await mkdir(directory, { recursive: true });
    const manifest = { jobId, project, seed: Number(process.env.H3_RENDER_SEED || 20260918), voiceover: voiceoverText ? { text: voiceoverText, voice, instructions } : null };
    await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await writeFile(join(directory, "status.json"), JSON.stringify({ status: "queued", stage: "queued", jobId, projectId, totalScenes: project.scenes.length, completedScenes: 0, createdAt: new Date().toISOString() }, null, 2), "utf8");
    const worker = join(process.cwd(), "scripts", "h3-render-worker.mjs");
    const child = spawn(process.execPath, [worker, join(directory, "manifest.json")], { detached: true, stdio: "ignore", env: process.env });
    child.unref();
    return NextResponse.json({ status: "queued", jobId, projectId, totalScenes: project.scenes.length, statusUrl: `/api/tools/ai-video-director/render?jobId=${encodeURIComponent(jobId)}` }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось поставить видео в очередь" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  try {
    return NextResponse.json(await readJob(jobId));
  } catch {
    return NextResponse.json({ error: "Задача рендера не найдена" }, { status: 404 });
  }
}
