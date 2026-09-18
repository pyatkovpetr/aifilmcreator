import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VideoDirectorAnalysis, VideoDirectorIdea, VideoDirectorInput, VideoDirectorProject, VideoDirectorScene } from "@/lib/ai-video-director";

type Draft = { id: string; type: "ideas"; input: VideoDirectorInput; analysis: VideoDirectorAnalysis; ideas: VideoDirectorIdea[]; userId: string; createdAt: string; updatedAt: string };
type StoredProject = VideoDirectorProject & { type: "storyboard"; userId: string; unlocked: boolean; paymentId?: string; updatedAt: string };
type StoreData = { drafts: Draft[]; projects: StoredProject[] };

const dataDir = process.env.AI_DIRECTOR_DATA_DIR || join(process.cwd(), ".data");
const dataFile = join(dataDir, "projects.json");
let writeQueue: Promise<void> = Promise.resolve();

async function readStore(): Promise<StoreData> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as StoreData;
  } catch {
    return { drafts: [], projects: [] };
  }
}

async function writeStore(data: StoreData): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const temp = `${dataFile}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2), "utf8");
  await rename(temp, dataFile);
}

async function mutate<T>(fn: (data: StoreData) => T | Promise<T>): Promise<T> {
  let result!: T;
  const run = writeQueue.then(async () => {
    const data = await readStore();
    result = await fn(data);
    await writeStore(data);
  });
  writeQueue = run.then(() => undefined, () => undefined);
  await run;
  return result;
}

export async function saveDraft(draft: Draft): Promise<void> { await mutate((data) => { data.drafts = [draft, ...data.drafts.filter((item) => item.id !== draft.id)].slice(0, 40); }); }
export async function getDraft(id: string): Promise<Draft | null> { return (await readStore()).drafts.find((item) => item.id === id) || null; }
export async function saveProject(project: VideoDirectorProject, userId: string): Promise<void> {
  await mutate((data) => {
    const existing = data.projects.find((item) => item.projectId === project.projectId);
    const record: StoredProject = { ...project, type: "storyboard", userId, unlocked: existing?.unlocked || false, paymentId: existing?.paymentId, updatedAt: new Date().toISOString() };
    data.projects = [record, ...data.projects.filter((item) => item.projectId !== project.projectId)].slice(0, 100);
  });
}
export async function getProject(id: string): Promise<StoredProject | null> { return (await readStore()).projects.find((item) => item.projectId === id) || null; }
export async function listProjects(userId: string): Promise<StoredProject[]> { return (await readStore()).projects.filter((item) => item.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 24); }
export async function unlockProject(id: string): Promise<{ ok: boolean; paymentId?: string }> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.projectId === id);
    if (!project) return { ok: false };
    project.unlocked = true;
    project.paymentId ||= `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    project.updatedAt = new Date().toISOString();
    return { ok: true, paymentId: project.paymentId };
  });
}
export async function updateScenes(id: string, scenes: VideoDirectorScene[]): Promise<StoredProject | null> {
  return mutate((data) => {
    const project = data.projects.find((item) => item.projectId === id);
    if (!project || !project.unlocked) return null;
    project.scenes = scenes;
    project.updatedAt = new Date().toISOString();
    return project;
  });
}
