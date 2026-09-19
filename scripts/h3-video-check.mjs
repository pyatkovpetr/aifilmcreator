import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function inspectVideo(path, options = {}) {
  const ffmpegBin = options.ffmpegBin || "ffmpeg";
  const ffprobeBin = options.ffprobeBin || "ffprobe";
  const probe = await execFileAsync(ffprobeBin, [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path,
  ], { maxBuffer: 1024 * 1024 });
  const duration = Number(probe.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) return { visible: false, reason: "invalid_duration", duration };

  const scan = await execFileAsync(ffmpegBin, [
    "-hide_banner", "-i", path, "-vf", "blackdetect=d=0.5:pix_th=0.01", "-an", "-f", "null", "-",
  ], { maxBuffer: 4 * 1024 * 1024 });
  const blackIntervals = [...scan.stderr.matchAll(/black_start:\s*([0-9.]+)\s+black_end:\s*([0-9.]+)\s+black_duration:\s*([0-9.]+)/g)]
    .map((match) => ({ start: Number(match[1]), end: Number(match[2]), duration: Number(match[3]) }));
  const longestBlack = Math.max(0, ...blackIntervals.map((interval) => interval.duration));
  return { visible: longestBlack < 0.5, duration, longestBlack, blackIntervals };
}
