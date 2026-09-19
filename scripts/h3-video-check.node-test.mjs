import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { inspectVideo } from "./h3-video-check.mjs";

const execFileAsync = promisify(execFile);

test("rejects fully black video and accepts visible video", async () => {
  const dir = await mkdtemp(join(tmpdir(), "h3-video-check-"));
  try {
    const black = join(dir, "black.mp4");
    const visible = join(dir, "visible.mp4");
    await execFileAsync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=24:d=2", "-pix_fmt", "yuv420p", black]);
    await execFileAsync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=64x64:r=24:d=2", "-pix_fmt", "yuv420p", visible]);
    assert.equal((await inspectVideo(black)).visible, false);
    assert.equal((await inspectVideo(visible)).visible, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects video with a sustained black opening", async () => {
  const dir = await mkdtemp(join(tmpdir(), "h3-video-check-"));
  try {
    const black = join(dir, "black.mp4");
    const red = join(dir, "red.mp4");
    const concat = join(dir, "concat.txt");
    const mixed = join(dir, "mixed.mp4");
    await execFileAsync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=24:d=1", "-pix_fmt", "yuv420p", black]);
    await execFileAsync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=64x64:r=24:d=1", "-pix_fmt", "yuv420p", red]);
    await writeFile(concat, `file '${black}'\nfile '${red}'\n`);
    await execFileAsync("ffmpeg", ["-v", "error", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", mixed]);
    assert.equal((await inspectVideo(mixed)).visible, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
