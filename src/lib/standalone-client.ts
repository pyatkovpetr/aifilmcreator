export const ANALYZE_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const AI_VIDEO_DIRECTOR_DRAFT_STORAGE_KEY = "ai-film-creator:director-draft";

export function largeAudioFileMessage(sizeMb: number): string {
  return `Аудиофайл слишком большой (${Math.round(sizeMb)} МБ). Максимум — 100 МБ.`;
}

export function getAuthHeaders(): Record<string, string> {
  return { "x-director-user": "local-browser" };
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { credentials: "include", ...init });
}

export type StandaloneUser = { song_credits: number; referral_bonus: number };
