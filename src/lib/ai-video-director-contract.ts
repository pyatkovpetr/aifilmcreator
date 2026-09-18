export const VIDEO_DIRECTOR_MIN_DURATION_SEC = 20;
export const VIDEO_DIRECTOR_MAX_DURATION_SEC = 600;

export function normalizeVideoDirectorDuration(durationSec: number, fallbackSec = 180): number {
  const safeFallback = Number.isFinite(fallbackSec)
    ? Math.min(VIDEO_DIRECTOR_MAX_DURATION_SEC, Math.max(VIDEO_DIRECTOR_MIN_DURATION_SEC, Math.round(fallbackSec)))
    : 180;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return safeFallback;
  return Math.min(VIDEO_DIRECTOR_MAX_DURATION_SEC, Math.max(VIDEO_DIRECTOR_MIN_DURATION_SEC, Math.round(durationSec)));
}
