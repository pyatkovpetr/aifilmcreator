import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const comfyUrl = (process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
const ffmpegBin = process.env.H3_FFMPEG_BIN || "ffmpeg";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("manifest path is required");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const jobDir = dirname(manifestPath);
const statusPath = join(jobDir, "status.json");
const outputDir = join(jobDir, "segments");
const finalPath = join(jobDir, "final.mp4");

async function writeStatus(patch) {
  let current = {};
  try {
    current = JSON.parse(await readFile(statusPath, "utf8"));
  } catch {}
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const temp = `${statusPath}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2), "utf8");
  await rename(temp, statusPath);
}

function h3Length(seconds) {
  const frames = Math.max(5, Math.round(seconds * 24));
  return frames + (5 - (frames % 17)) % 17;
}

function workflowForScene(scene, index, config) {
  const prompt = [
    scene.prompt,
    `Negative / exclude: ${scene.negativePrompt || "no text, no logos, no watermark, no subtitles, no artifacts"}.`,
    "Generate coherent live-action video with natural motion and continuity for the same lead character. Keep the subject and environment clearly visible in every frame with correct exposure, lifted shadow detail, and no black, blank, or underexposed frames.",
  ].join(" ");
  // The base seed produced an all-black first segment on the FL2VA checkpoint.
  // Start the sequence one step into the tested seed range for stable output.
  const seed = (Number(config.seed || 20260918) + (index + 1) * 7919) >>> 0;
  return {
    "119": { class_type: "VAELoader", inputs: { vae_name: "minimax_h3_video_vae_fp16.safetensors" } },
    "122": { class_type: "VAEDecode", inputs: { samples: ["125", 0], vae: ["119", 0] } },
    "123": { class_type: "KSamplerSelect", inputs: { sampler_name: "res_multistep" } },
    "124": { class_type: "BasicScheduler", inputs: { model: ["135", 0], scheduler: "simple", steps: 8, denoise: 1.0 } },
    "125": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["129", 0], guider: ["126", 0], sampler: ["123", 0], sigmas: ["124", 0], latent_image: ["131", 1] } },
    "126": { class_type: "BasicGuider", inputs: { model: ["135", 0], conditioning: ["131", 0] } },
    "127": { class_type: "UNETLoader", inputs: { unet_name: "minimax_h3_fl2va_pruned_int8_convrot.safetensors", weight_dtype: "default" } },
    "128": { class_type: "CLIPLoader", inputs: { clip_name: "qwen3vl_32b_minimax_h3_int8_convrot.safetensors", type: "minimax", device: "default" } },
    "129": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    // The director render has no uploaded soundtrack. Leaving the optional
    // audio input empty avoids exporting the NaN/Inf audio latent produced by
    // some FL2VA checkpoints while keeping the visual H3 segment intact.
    "130": { class_type: "CreateVideo", inputs: { images: ["122", 0], fps: 24, bit_depth: 8 } },
    "131": { class_type: "MiniMaxH3ImageToVideo", inputs: { clip: ["128", 0], vae: ["119", 0], prompt, width: config.width, height: config.height, length: h3Length(config.segmentSeconds) } },
    "134": { class_type: "LoraLoaderModelOnly", inputs: { model: ["127", 0], lora_name: "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors", strength_model: 1.0 } },
    "135": { class_type: "ComfySwitchNode", inputs: { on_false: ["127", 0], on_true: ["134", 0], switch: true } },
    "92": { class_type: "SaveVideo", inputs: { video: ["130", 0], filename_prefix: `ai_director/${manifest.jobId}/scene-${String(index + 1).padStart(3, "0")}`, format: "mp4", codec: "h264" } },
  };
}

async function comfyJson(pathname, init = {}) {
  const response = await fetch(`${comfyUrl}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`ComfyUI ${response.status}: ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : {};
}

async function queue(workflow, index) {
  return comfyJson("/prompt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: `${manifest.jobId}-${index}` }),
  });
}

async function waitForPrompt(promptId, index) {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const history = await comfyJson(`/history/${encodeURIComponent(promptId)}`);
    const item = history[promptId];
    if (!item) continue;
    const status = item.status || {};
    if (status.status_str === "error") {
      const error = (status.messages || []).find((message) => message[0] === "execution_error")?.[1];
      throw new Error(`scene ${index + 1}: ${error?.exception_message || "ComfyUI execution error"}`);
    }
    if (status.completed || status.status_str === "success") return item;
  }
}

function outputReference(item) {
  const values = Object.values(item.outputs || {});
  const refs = values.flatMap((output) => ["videos", "gifs", "images", "files"].flatMap((key) => Array.isArray(output?.[key]) ? output[key] : []));
  const reference = refs.find((item) => item && typeof item.filename === "string");
  if (!reference) throw new Error("ComfyUI completed without a saved video reference");
  return reference;
}

async function downloadReference(reference, target) {
  const url = new URL(`${comfyUrl}/view`);
  url.search = new URLSearchParams({ filename: reference.filename, subfolder: reference.subfolder || "", type: reference.type || "output" }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ComfyUI video download failed: ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

function concatLine(path) {
  return `file '${path.replaceAll("'", "'\\''")}'`;
}

async function concatVideos(paths) {
  const concatPath = join(jobDir, "concat.txt");
  await writeFile(concatPath, `${paths.map(concatLine).join("\n")}\n`, "utf8");
  try {
    await execFileAsync(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", finalPath], { maxBuffer: 4 * 1024 * 1024 });
  } catch {
    await execFileAsync(ffmpegBin, ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", finalPath], { maxBuffer: 4 * 1024 * 1024 });
  }
}

await mkdir(outputDir, { recursive: true });
await writeStatus({ status: "running", stage: "starting", jobId: manifest.jobId, projectId: manifest.project.projectId, totalScenes: manifest.project.scenes.length, completedScenes: 0 });

try {
  const segmentPaths = [];
  for (let index = 0; index < manifest.project.scenes.length; index += 1) {
    const scene = manifest.project.scenes[index];
    const target = join(outputDir, `scene-${String(index + 1).padStart(3, "0")}.mp4`);
    const segmentSeconds = Number(process.env.H3_RENDER_SECONDS || Math.max(5, scene.endSec - scene.startSec));
    const config = { width: Number(process.env.H3_RENDER_WIDTH || 608), height: Number(process.env.H3_RENDER_HEIGHT || 352), segmentSeconds, seed: manifest.seed };
    await writeStatus({ stage: "rendering", scene: index + 1, totalScenes: manifest.project.scenes.length, completedScenes: index, segmentSeconds, prompt: scene.prompt });
    const queued = await queue(workflowForScene(scene, index, config), index);
    await writeStatus({ stage: "waiting_comfy", scene: index + 1, comfyPromptId: queued.prompt_id });
    const item = await waitForPrompt(queued.prompt_id, index);
    await downloadReference(outputReference(item), target);
    segmentPaths.push(target);
    await writeStatus({ stage: "segment_saved", scene: index + 1, completedScenes: index + 1, segmentPaths });
  }
  await writeStatus({ stage: "stitching", completedScenes: segmentPaths.length });
  await concatVideos(segmentPaths);
  await writeStatus({ status: "completed", stage: "completed", completedScenes: segmentPaths.length, finalPath, finalUrl: `/api/tools/ai-video-director/render/file?jobId=${encodeURIComponent(manifest.jobId)}`, segmentPaths });
} catch (error) {
  await writeStatus({ status: "failed", stage: "failed", error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
