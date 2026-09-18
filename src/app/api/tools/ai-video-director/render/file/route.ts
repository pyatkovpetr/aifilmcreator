import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

function dataDir() {
  return process.env.AI_DIRECTOR_DATA_DIR || join(process.cwd(), ".data");
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId") || "";
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) return NextResponse.json({ error: "Некорректный jobId" }, { status: 400 });
  try {
    const status = JSON.parse(await readFile(join(dataDir(), "renders", jobId, "status.json"), "utf8")) as { status?: string; finalPath?: string };
    if (status.status !== "completed" || !status.finalPath) return NextResponse.json({ error: "Видео ещё не готово" }, { status: 409 });
    const expectedPrefix = join(dataDir(), "renders", jobId) + "/";
    if (!status.finalPath.startsWith(expectedPrefix)) return NextResponse.json({ error: "Некорректный путь результата" }, { status: 500 });
    const buffer = await readFile(status.finalPath);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "video/mp4", "Content-Length": String(buffer.byteLength), "Content-Disposition": `attachment; filename="ai-director-${jobId}.mp4"`, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Видео не найдено" }, { status: 404 });
  }
}
