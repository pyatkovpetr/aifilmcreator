import { rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function addVoiceover(videoPath, voiceover, jobDir, options = {}) {
  const apiKey = options.apiKey || process.env.AI_DIRECTOR_TTS_API_KEY || (process.env.AI_DIRECTOR_LLM_URL?.includes("api.neuraldeep.ru") ? process.env.AI_DIRECTOR_LLM_API_KEY : "");
  if (!apiKey) throw new Error("NeuralDeep TTS API key is not configured");
  const response = await fetch(options.apiUrl || "https://api.neuraldeep.ru/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ input: voiceover.text, voice: voiceover.voice, language: "Russian", ...(voiceover.instructions ? { instructions: voiceover.instructions } : {}) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`NeuralDeep TTS HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("NeuralDeep TTS returned invalid WAV audio");
  }
  const wavPath = `${jobDir}/voiceover.wav`;
  const voicedPath = `${jobDir}/voiced.mp4`;
  await writeFile(wavPath, bytes);
  await execFileAsync(options.ffmpegBin || "ffmpeg", [
    "-y", "-i", videoPath, "-i", wavPath,
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
    "-af", "apad", "-shortest", "-movflags", "+faststart", voicedPath,
  ], { maxBuffer: 4 * 1024 * 1024 });
  await rename(voicedPath, videoPath);
  return { engine: response.headers.get("x-tts-engine") || "unknown", voice: voiceover.voice, wavBytes: bytes.length };
}
