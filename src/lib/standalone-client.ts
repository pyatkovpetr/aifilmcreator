export const ANALYZE_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const AI_VIDEO_DIRECTOR_DRAFT_STORAGE_KEY = "ai-film-creator:director-draft";

export function largeAudioFileMessage(sizeMb: number): string {
  return `Аудиофайл слишком большой (${Math.round(sizeMb)} МБ). Максимум — 100 МБ.`;
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return { "x-director-user": "local-server" };
  const key = "ai-film-creator:user-id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, id);
  }
  return { "x-director-user": id };
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { credentials: "include", ...init });
}

export type StandaloneUser = { song_credits: number; referral_bonus: number };
