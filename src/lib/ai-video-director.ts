import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  VIDEO_DIRECTOR_MAX_DURATION_SEC,
  VIDEO_DIRECTOR_MIN_DURATION_SEC,
  normalizeVideoDirectorDuration,
} from "@/lib/ai-video-director-contract";

export {
  VIDEO_DIRECTOR_MAX_DURATION_SEC,
  VIDEO_DIRECTOR_MIN_DURATION_SEC,
  normalizeVideoDirectorDuration,
} from "@/lib/ai-video-director-contract";

export const VIDEO_DIRECTOR_PRICE_RUB = 149;
export const VIDEO_DIRECTOR_TOKEN_COST = 5;
export const VIDEO_DIRECTOR_SEGMENT_SECONDS = 10;

const ModeSchema = z.enum(["clip", "film"]);

const AudioAnalysisSchema = z.object({
  duration: z.coerce.number().min(0).max(3600).optional(),
  bpm: z.coerce.number().min(20).max(260).optional(),
  key: z.string().trim().max(24).optional(),
  mode: z.string().trim().max(24).optional(),
  lufs: z.coerce.number().min(-80).max(5).optional(),
});

export const VideoDirectorInputSchema = z.object({
  mode: ModeSchema.default("clip"),
  title: z.string().trim().max(120).optional().default(""),
  sourceText: z.string().trim().min(20).max(12_000),
  durationSec: z.coerce.number().int().min(VIDEO_DIRECTOR_MIN_DURATION_SEC).max(VIDEO_DIRECTOR_MAX_DURATION_SEC).default(180),
  vocalProfile: z.string().trim().max(180).optional().default(""),
  energy: z.string().trim().max(80).optional().default(""),
  visualStyle: z.string().trim().max(160).optional().default("реалистичный кинематографичный стиль"),
  locations: z.string().trim().max(700).optional().default(""),
  referenceNotes: z.string().trim().max(1000).optional().default(""),
  constraints: z.string().trim().max(1000).optional().default(""),
  targetModel: z.string().trim().max(80).optional().default("универсальный видеогенератор"),
  audioAnalysis: AudioAnalysisSchema.optional(),
});

export type VideoDirectorInput = z.infer<typeof VideoDirectorInputSchema>;
export type VideoDirectorMode = z.infer<typeof ModeSchema>;
export type VideoDirectorAudioAnalysis = z.infer<typeof AudioAnalysisSchema>;

export type VideoDirectorAnalysis = {
  language: string;
  mood: string;
  energy: string;
  structure: string[];
  keyImages: string[];
  directorNote: string;
};

export type VideoDirectorIdea = {
  id: string;
  title: string;
  logline: string;
  visualStyle: string;
  locations: string[];
  whyItFits: string;
  rules: string[];
};

export type VideoDirectorScene = {
  id: number;
  startSec: number;
  endSec: number;
  label: string;
  purpose: string;
  visual: string;
  camera: string;
  lighting: string;
  action: string;
  prompt: string;
  negativePrompt: string;
};

export type VideoDirectorProject = {
  projectId: string;
  input: VideoDirectorInput;
  analysis: VideoDirectorAnalysis;
  ideas: VideoDirectorIdea[];
  selectedIdea: VideoDirectorIdea;
  scenes: VideoDirectorScene[];
  totalScenes: number;
  createdAt: string;
};

export type PublicVideoDirectorProject = Omit<VideoDirectorProject, "scenes"> & {
  scenes: VideoDirectorScene[];
  lockedCount: number;
  unlocked: boolean;
  priceRub: number;
  tokenCost: number;
};

type IdeasPayload = {
  analysis: VideoDirectorAnalysis;
  ideas: VideoDirectorIdea[];
};

const FALLBACK_NEGATIVE =
  "no subtitles, no random text, no watermark, no logo artifacts, no extra fingers, no distorted face, no duplicated lead character, no anime unless requested, no plastic skin, no wrong ethnicity, no unreadable signs";

export function parseVideoDirectorInput(input: unknown): VideoDirectorInput {
  return VideoDirectorInputSchema.parse(input);
}

export function formatVideoDirectorInputError(error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return error instanceof Error ? error.message : "Не удалось создать идеи";
  }

  const fields = new Set(error.issues.map((issue) => String(issue.path[0] || "")));
  if (fields.has("durationSec")) {
    return "Длительность сценария должна быть от 20 секунд до 10 минут.";
  }
  if (fields.has("sourceText")) {
    return "Добавьте текст песни или описание сцены длиной не менее 20 символов.";
  }
  return "Проверьте заполнение полей и попробуйте ещё раз.";
}

export function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

export function getVideoDirectorSceneCount(input: Pick<VideoDirectorInput, "durationSec">): number {
  return Math.max(1, Math.ceil(input.durationSec / VIDEO_DIRECTOR_SEGMENT_SECONDS));
}

export function getProjectTotalScenes(project: Pick<VideoDirectorProject, "input" | "scenes"> & { totalScenes?: number }): number {
  return Math.max(project.totalScenes || 0, getVideoDirectorSceneCount(project.input), project.scenes.length);
}

export function serializeVideoDirectorProject(
  project: VideoDirectorProject,
  unlocked: boolean,
): PublicVideoDirectorProject {
  const totalScenes = getProjectTotalScenes(project);
  const scenes = unlocked ? project.scenes : project.scenes.slice(0, 2);
  return {
    ...project,
    totalScenes,
    scenes,
    lockedCount: unlocked ? 0 : Math.max(0, totalScenes - scenes.length),
    unlocked,
    priceRub: VIDEO_DIRECTOR_PRICE_RUB,
    tokenCost: VIDEO_DIRECTOR_TOKEN_COST,
  };
}

export function toProjectId(id: unknown): string {
  const value = String(id || "").trim();
  if (!/^[a-z0-9-]{8,80}$/i.test(value)) return "";
  return value;
}

export function normalizeIdeaId(id: unknown): string {
  const value = String(id || "").trim().toLowerCase();
  return /^[a-z0-9_-]{1,40}$/.test(value) ? value : "";
}

function compactList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function cleanText(value: unknown, fallback: string, max = 1200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function detectLanguage(text: string): string {
  if (/[ҠҡҒғҘҙҪҫҢңӨөҮүӘәҺһ]/.test(text)) return "башкирский";
  if (/[А-Яа-яЁё]/.test(text)) return "русский";
  if (/[A-Za-z]/.test(text)) return "английский";
  return "смешанный";
}

function extractSections(text: string): string[] {
  const matches = [...text.matchAll(/\[(intro|verse\s*\d*|chorus|bridge|outro|куплет|припев|бридж|интро|аутро)[^\]]*\]/gi)];
  const labels = matches.map((m) => m[0].replace(/[[\]]/g, "").trim());
  if (labels.length > 0) return [...new Set(labels)].slice(0, 12);
  if (text.length > 2000) return ["Начало", "Развитие", "Кульминация", "Финал"];
  return ["Начало", "Основное действие", "Финал"];
}

function sourceContext(input: Pick<VideoDirectorInput, "sourceText" | "locations" | "referenceNotes">): string {
  return `${input.sourceText}\n${input.locations}\n${input.referenceNotes}`.toLowerCase();
}

function hasUserDefinedLocations(input: Pick<VideoDirectorInput, "locations">): boolean {
  const value = input.locations.trim();
  if (!value) return false;
  return !/определи|предложи|по смыслу|из текста|главная локация|пространство перехода/i.test(value);
}

function locationsPrompt(input: Pick<VideoDirectorInput, "locations">): string {
  return hasUserDefinedLocations(input)
    ? input.locations
    : "не заданы; выводи локации только из текста, описания сцены и пользовательских референсов";
}

function sanitizeGeneratedText(input: VideoDirectorInput, value: string): string {
  let next = value;
  const context = sourceContext(input);
  const replacements: Array<[RegExp, string]> = [];

  if (!/арт[-\s]?квадрат/i.test(context)) {
    replacements.push([/арт[-\s]?квадрат[а-я]*/gi, "пространство по смыслу песни"]);
  }
  if (!/уфа/i.test(context)) {
    replacements.push([/уф[а-я]*/gi, "город из текста песни"]);
  }
  if (!/башкортостан/i.test(context) && !/башҡ|башкир/i.test(context)) {
    replacements.push([/башкортостан[а-я]*/gi, "мир песни"]);
    replacements.push([/башкир[а-я]*/gi, "локальный контекст песни"]);
  }
  if (!/шульган[-\s]?таш|shulgan[-\s]?tash/i.test(context)) {
    replacements.push([/шульган[-\s]?таш[а-я]*/gi, "каменный мир Шульгана"]);
  }

  for (const [re, replacement] of replacements) {
    next = next.replace(re, replacement);
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

function sanitizeGeneratedList(input: VideoDirectorInput, values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => sanitizeGeneratedText(input, value))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function deriveLocationsFromText(input: VideoDirectorInput, analysis: VideoDirectorAnalysis): string[] {
  if (hasUserDefinedLocations(input)) {
    return sanitizeGeneratedList(
      input,
      input.locations.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 4),
    );
  }

  const text = input.sourceText.toLowerCase();
  const locations: string[] = [];
  if (/золот|серебр|сокровищ|камн/.test(text)) locations.push("пространство чёрных камней с золотыми и серебряными бликами");
  if (/город/.test(text)) locations.push("грустный город как внутреннее состояние героя");
  if (/свет|свобод|выходим|выход/.test(text)) locations.push("открытое пространство света и свободы");
  if (/танц|потанцуем|друз/.test(text)) locations.push("площадка общего танца друзей");

  const fallback = analysis.keyImages.length ? analysis.keyImages : ["главная локация песни", "пространство героя", "финальный выход к свету"];
  return sanitizeGeneratedList(input, locations.length ? locations.slice(0, 4) : fallback.slice(0, 4));
}

function extractKeyImages(text: string, input: VideoDirectorInput): string[] {
  const haystack = sourceContext(input);
  const images: string[] = [];
  if (/шульган[-\s]?таш|shulgan[-\s]?tash/i.test(haystack)) {
    images.push("Шульган-Таш, камень и пещерный свет");
  } else if (/шульг|шульган/i.test(haystack)) {
    images.push("Шульган как сила из текста, золото и чёрные камни");
  }
  const candidates: Array<[RegExp, string]> = [
    [/пещер/i, "пещерный свет и каменные стены"],
    [/йылға|река|water|river/i, "река, вода и отражения"],
    [/ут|огонь|fire/i, "огонь, тёплый свет и искры"],
    [/яҡтылыҡ|свет|light/i, "выход к свету"],
    [/золот|серебр|сокровищ/i, "золото, серебро и ложное сокровище"],
    [/ч[её]рн\w*\s+камн|камн/i, "чёрные камни и блеск"],
    [/город|city|street|площад/i, "грустный город из текста"],
    [/танц|dance|хореограф/i, "синхронное движение и танец"],
  ];
  for (const [re, label] of candidates) {
    if (re.test(haystack) && !images.includes(label)) images.push(label);
  }
  return sanitizeGeneratedList(input, images.length ? images.slice(0, 6) : ["главный персонаж", "свет", "движение", "эмоциональная кульминация"]);
}

function fallbackAnalysis(input: VideoDirectorInput): VideoDirectorAnalysis {
  const keyImages = extractKeyImages(input.sourceText, input);
  const isClip = input.mode === "clip";
  const bpm = input.audioAnalysis?.bpm;
  const audioEnergy =
    bpm && bpm >= 125
      ? "быстрая, танцевальная, высокий монтажный темп"
      : bpm && bpm <= 82
        ? "медленная, драматичная, больше крупных планов"
        : bpm
          ? "средний темп, пластичный монтаж"
          : "";
  return {
    language: detectLanguage(input.sourceText),
    mood: /свет|яҡтылыҡ|побед|ут|сила|рух/i.test(input.sourceText)
      ? "героическое движение от тьмы к свету"
      : isClip
        ? "музыкальный образ с нарастающей эмоцией"
        : "кинематографичная сцена с понятной драматической дугой",
    energy: input.energy || audioEnergy || input.vocalProfile || (isClip ? "средняя с ростом к припевам" : "управляемая драматическая"),
    structure: extractSections(input.sourceText),
    keyImages,
    directorNote: isClip
      ? "Держать связь текста, вокала и визуальных символов; не превращать клип в набор случайных красивых кадров."
      : "Каждый 10-секундный фрагмент должен менять состояние сцены: взгляд, действие, конфликт или решение.",
  };
}

function audioAnalysisPrompt(input: VideoDirectorInput): string {
  const audio = input.audioAnalysis;
  if (!audio) return "Аудио-анализ: не загружен.";
  return [
    "Аудио-анализ:",
    audio.duration ? `длительность ${Math.round(audio.duration)} секунд` : "",
    audio.bpm ? `BPM ${Math.round(audio.bpm)}` : "",
    audio.key ? `тональность ${audio.key}${audio.mode ? ` ${audio.mode}` : ""}` : "",
    typeof audio.lufs === "number" ? `LUFS ${audio.lufs}` : "",
  ].filter(Boolean).join(" ");
}

function fallbackIdeas(input: VideoDirectorInput, analysis: VideoDirectorAnalysis): VideoDirectorIdea[] {
  const isClip = input.mode === "clip";
  const baseLocations = deriveLocationsFromText(input, analysis);
  const images = analysis.keyImages.length ? analysis.keyImages : ["главный образ", "контраст", "финальный эмоциональный пик"];
  const firstImage = images[0] || "главный образ";
  const secondImage = images[1] || "второй ключевой образ";
  const finalImage = images[images.length - 1] || "финальный эмоциональный пик";

  const genericIdeas: VideoDirectorIdea[] = [
    {
      id: "performance-story",
      title: isClip ? "Performance + смысл текста" : "Один конфликт в одном пространстве",
      logline: isClip
        ? `Артист ведёт клип через performance, а сюжетные вставки раскрывают образы: ${firstImage}, ${secondImage}.`
        : "Сцена держится на ясном конфликте, смене дистанции между героями и нарастающем выборе.",
      visualStyle: input.visualStyle || "реалистичный cinematic live action",
      locations: baseLocations.length ? baseLocations : ["главное пространство истории", "крупные планы героя", "финальное пространство"],
      whyItFits: "Даёт понятную структуру и хорошо переносится в видеогенераторы.",
      rules: ["один визуальный стиль", "каждый кадр привязан к строке текста", "без случайных объектов и реальных мест, которых нет во вводе"],
    },
    {
      id: "journey",
      title: "Путь героя",
      logline: `Главный персонаж проходит от состояния «${firstImage}» к финальному образу «${finalImage}».`,
      visualStyle: "реалистичный road-movie монтаж, свет меняется от холодного к тёплому",
      locations: baseLocations.length ? baseLocations : ["замкнутое начало", "переходное пространство", "открытый финал"],
      whyItFits: "Удобно делить на 10-секундные сцены с нарастанием.",
      rules: ["каждая сцена двигает героя", "не менять лицо персонажа", "сохранять костюмные признаки"],
    },
    {
      id: "dance-energy",
      title: "Энергия движения",
      logline: "Смысл передаётся через пластическое движение, группу и синхронность на ключевых повторах текста.",
      visualStyle: "современная хореография, handheld + tracking shots, живой свет",
      locations: baseLocations.length ? baseLocations : ["пространство подготовки", "проход движения", "финальная танцевальная площадка"],
      whyItFits: "Хорошо работает для сильной музыки и припевов.",
      rules: ["движения не должны выглядеть случайными", "камера поддерживает ритм", "группа не перекрывает лидера"],
    },
    {
      id: "symbolic-realism",
      title: "Символический реализм",
      logline: `Реальные детали становятся символами текста: ${images.slice(0, 4).join(", ")}.`,
      visualStyle: "поэтичный реализм без фэнтези, предметные крупные планы, натуральные фактуры",
      locations: baseLocations.length ? baseLocations : ["реальная локация по смыслу песни", "детали символов", "финальный широкий кадр"],
      whyItFits: "Позволяет сделать дорогой клип без сложных VFX.",
      rules: ["символы через реальные предметы", "без буквальных клише", "меньше текста на экране"],
    },
    {
      id: "modern-stage",
      title: "Современная сцена",
      logline: "Действие начинается как подготовка, а заканчивается мощным выступлением в открытом пространстве.",
      visualStyle: "концертный кинореализм, LED/дневной свет, уверенный темп монтажа",
      locations: baseLocations.length ? baseLocations : ["пространство подготовки", "performance-зона", "широкий финал"],
      whyItFits: "Продаёт артиста и легко собирается из коротких AI-сцен.",
      rules: ["артист узнаваем в каждом кадре", "избегать хаотичного света", "финал должен быть шире начала"],
    },
  ];

  return genericIdeas.slice(0, 5).map((idea) => ({
    ...idea,
    title: sanitizeGeneratedText(input, idea.title),
    logline: sanitizeGeneratedText(input, idea.logline),
    visualStyle: sanitizeGeneratedText(input, idea.visualStyle),
    locations: sanitizeGeneratedList(input, idea.locations),
    whyItFits: sanitizeGeneratedText(input, idea.whyItFits),
    rules: sanitizeGeneratedList(input, idea.rules),
  }));
}

type SceneBlueprint = {
  character: string;
  wardrobe: string;
  location: string;
  supportingCast: string;
  foregroundDetail: string;
  lyricBeat: string;
  transition: string;
};

function splitLooseList(value: string, fallback: string[]): string[] {
  const items = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function extractLyricBeats(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\[[^\]]+\]/g, "").trim())
    .filter((line) => line.length >= 3)
    .map((line) => line.replace(/\s+/g, " ").slice(0, 160));
  return lines.length ? lines : ["эмоциональный мотив песни", "смена состояния героя", "переход к кульминации"];
}

function musicBeatLabel(progress: number): string {
  if (progress < 0.08) return "Интро";
  if (progress < 0.28) return "Куплет 1";
  if (progress < 0.38) return "Предприпев";
  if (progress < 0.53) return "Припев 1";
  if (progress < 0.68) return "Куплет 2";
  if (progress < 0.78) return "Бридж";
  if (progress < 0.94) return "Финальный припев";
  return "Аутро";
}

function sceneLabel(input: VideoDirectorInput, analysis: VideoDirectorAnalysis, index: number, count: number): string {
  const progress = count <= 1 ? 1 : index / Math.max(1, count - 1);
  const genericStructure = analysis.structure.length <= 3 && analysis.structure.every((item) =>
    /^(начало|основное действие|финал|развитие|кульминация)$/i.test(item),
  );
  if (input.mode === "clip" && genericStructure) return musicBeatLabel(progress);
  const sectionIndex = Math.min(
    analysis.structure.length - 1,
    Math.floor(progress * analysis.structure.length),
  );
  return analysis.structure[sectionIndex] || (input.mode === "clip" ? musicBeatLabel(progress) : "Фрагмент сцены");
}

function scenePurpose(index: number, count: number, label: string, idea: VideoDirectorIdea): string {
  const progress = count <= 1 ? 1 : index / Math.max(1, count - 1);
  if (index === 0) return `Задать героя, визуальное правило концепции «${idea.title}» и первый крючок песни.`;
  if (index === count - 1) return "Закрыть клип финальным образом, который можно использовать как обложку или стоп-кадр.";
  if (/припев|финал|кульминац/i.test(label)) return "Собрать максимум вокальной энергии, движения камеры и понятный эмоциональный пик.";
  if (progress < 0.35) return "Показать новое действие героя и подготовить переход к следующей музыкальной части.";
  if (progress < 0.75) return "Усилить конфликт, добавить второй план и сделать монтажный шаг вперёд.";
  return "Подвести к кульминации и соединить главные символы с действием героя.";
}

function ideaKind(idea: VideoDirectorIdea): "performance" | "journey" | "dance" | "symbolic" | "stage" | "ethno" {
  const value = `${idea.id} ${idea.title} ${idea.logline}`.toLowerCase();
  if (/dance|движ|хореограф|танц/.test(value)) return "dance";
  if (/journey|путь|выход|хранитель|light-exit|one-heroine/.test(value)) return "journey";
  if (/symbolic|символ|реализм|память|water|river/.test(value)) return "symbolic";
  if (/stage|сцен|modern-stage|концерт/.test(value)) return "stage";
  if (/ritual|обряд|этно/.test(value)) return "ethno";
  return "performance";
}

function pickVariant(items: string[], index: number, progress: number): string {
  if (!items.length) return "";
  const baseIndex = Math.min(items.length - 1, Math.floor(progress * items.length));
  return items[(baseIndex + index) % items.length] || items[0];
}

function buildSceneBlueprint(
  input: VideoDirectorInput,
  idea: VideoDirectorIdea,
  lyricBeats: string[],
  index: number,
  count: number,
): SceneBlueprint {
  const progress = count <= 1 ? 1 : index / Math.max(1, count - 1);
  const kind = ideaKind(idea);
  const locations = splitLooseList(input.locations, idea.locations.length ? idea.locations : ["студия", "улица", "открытая площадка"]);
  const location = pickVariant(locations, index, progress);
  const baseCharacter =
    input.mode === "clip"
      ? input.vocalProfile || "один главный артист, эмоциональный вокал, узнаваемое лицо"
      : input.vocalProfile || "главный герой сцены, реалистичная актёрская игра, выразительный взгляд";
  const character = `${baseCharacter}; один и тот же человек во всех сценах, без дублей и случайной смены лица`;
  const lyricBeat = lyricBeats[index % lyricBeats.length] || "ключевая эмоция текущей строки";

  const wardrobeByKind: Record<ReturnType<typeof ideaKind>, string[]> = {
    performance: [
      "цельный сценический образ: тёмный жакет или платье, один узнаваемый аксессуар, аккуратный макияж",
      "тот же образ, добавляется микрофон или in-ear монитор как деталь выступления",
      "финальный вариант образа с более ярким контровым светом, без смены лица и силуэта",
    ],
    journey: [
      "светлый плащ или длинная куртка поверх базового сценического костюма",
      "тот же костюм, на ткани видны следы движения: ветер, дождевые капли или пыль света",
      "финал без лишних аксессуаров: чистый силуэт героя на открытом пространстве",
    ],
    dance: [
      "удобный сценический streetwear, контрастный верх, волосы и силуэт читаются в движении",
      "тот же костюм, вокруг группа в приглушённых тонах, лидер визуально ярче",
      "финальный dance look с акцентом на линии рук и корпуса, без лишних деталей",
    ],
    symbolic: [
      "минималистичный костюм нейтрального цвета, выразительные руки и лицо",
      "тот же образ, крупные детали ткани, кожи, украшения или предмета-символа",
      "финальный чистый силуэт, символический предмет остаётся в кадре",
    ],
    stage: [
      "дорогой performance look, чёткий силуэт, микрофонная стойка или backstage-деталь",
      "тот же костюм под концертным светом, лицо узнаваемо в каждом крупном плане",
      "финальный сценический образ в широком кадре, без хаотичных бликов",
    ],
    ethno: [
      "современный сценический костюм с тонкими локальными мотивами, без карикатуры",
      "тот же костюм, один культурный аксессуар или фактура ткани как акцент",
      "финальный образ с уважительной локальной деталью, натуральные лица вокруг",
    ],
  };

  const castByKind: Record<ReturnType<typeof ideaKind>, string[]> = {
    performance: [
      "на фоне видны музыканты или техник, но они не перетягивают внимание",
      "сюжетная вставка с одним второстепенным персонажем отражает смысл строки",
      "в финале группа зрителей или команда появляется как поддержка, главный артист остаётся центром",
    ],
    journey: [
      "второй план почти пустой, пространство давит на героя",
      "несколько прохожих или силуэтов подчёркивают путь, но не становятся новыми героями",
      "в финале люди стоят сбоку или сзади, как подтверждение пройденного пути",
    ],
    dance: [
      "танцоры ждут импульс от лидера, расстановка оставляет центр свободным",
      "группа отвечает на движение лидера синхронно, без перекрытия лица",
      "финальная формация раскрывается вокруг лидера полукругом или диагональю",
    ],
    symbolic: [
      "людей почти нет, смысл держится на руках, предметах и пространстве",
      "один силуэт на фоне добавляет масштаб, не объясняя сцену буквально",
      "финал собирает предметы и героя в один ясный символический кадр",
    ],
    stage: [
      "backstage-команда готовит свет, кабели и микрофон, всё выглядит дорого и реалистично",
      "музыканты и световики существуют как живой второй план",
      "на финале зрители или городская площадка раскрываются шире, артист остаётся в фокусе",
    ],
    ethno: [
      "второстепенные люди с локальными лицами и современными деталями стоят по краям кадра",
      "музыкант, танцор или старший персонаж появляется как реальная связь культуры",
      "общая группа поддерживает финальный подъём, не превращая сцену в открытку",
    ],
  };

  const foregroundByKind: Record<ReturnType<typeof ideaKind>, string[]> = {
    performance: [
      "зеркало с живым отражением лица артиста",
      "микрофонная стойка и рука на кабеле",
      "световой прибор, включающийся в момент вокального акцента",
      "пустой край сцены или ряд кресел перед выступлением",
      "неоновый блик на стекле backstage-двери",
      "крупный план губ, дыхания и in-ear монитора",
    ],
    journey: [
      "дверная щель с тёплым светом впереди",
      "мокрый асфальт или каменная поверхность под шагом героя",
      "рука героя на холодном стекле или стене",
      "ткань костюма, которую поднимает ветер",
      "силуэт героя в широком пустом пространстве",
      "первый прямой солнечный луч на лице",
    ],
    dance: [
      "первый удар стопы по полу",
      "линия рук лидера на сильной доле",
      "круг света на полу вокруг группы",
      "расходящиеся ряды танцоров",
      "синхронный поворот корпуса",
      "финальная фиксация формации вокруг лидера",
    ],
    symbolic: [
      "зеркальная поверхность с мягким отражением",
      "ткань или лента, проходящая через пальцы",
      "капли воды или свет на коже рук",
      "предмет-символ в крупном плане",
      "тень героя на стене",
      "спокойный широкий кадр, где символ остаётся в центре",
    ],
    stage: [
      "лампы сцены перед включением",
      "микрофон на стойке в контровом свете",
      "кабель, монитор и рука звукорежиссёра",
      "движущийся луч света за спиной артиста",
      "край площадки и первые зрители в глубине",
      "широкое раскрытие сцены на финальном акценте",
    ],
    ethno: [
      "локальная фактура ткани или украшения без карикатуры",
      "руки музыканта или танцора на втором плане",
      "реальная архитектурная деталь места",
      "тёплый свет на лицах людей по краям кадра",
      "предмет культуры в современном окружении",
      "общий кадр с людьми и пространством без открытки",
    ],
  };

  const transitions = [
    "монтажный переход через движение руки или поворот головы",
    "переход через световой блик, отражение или проход камеры за объектом",
    "переход через match cut: похожая форма в другой локации",
    "переход через смену масштаба от крупного плана к широкому",
  ];

  return {
    character,
    wardrobe: pickVariant(wardrobeByKind[kind], index, progress),
    location,
    supportingCast: pickVariant(castByKind[kind], index, progress),
    foregroundDetail: pickVariant(foregroundByKind[kind], index, progress),
    lyricBeat,
    transition: transitions[index % transitions.length],
  };
}

function sceneAction(kind: ReturnType<typeof ideaKind>, progress: number, label: string, index: number): string {
  const isPeak = /припев|финал|кульминац/i.test(label) || progress > 0.72;
  const actions: Record<ReturnType<typeof ideaKind>, string[][]> = {
    performance: [
      [
        "Артист входит в кадр через подготовку к выступлению: взгляд в зеркало, рука на микрофоне, первый вдох перед строкой.",
        "Артист проходит через backstage к свету, на ходу поправляет деталь костюма и ловит первый вокальный акцент.",
        "Артист остаётся в полутёмной студии, начинает петь почти шёпотом, камера фиксирует напряжение лица и рук.",
      ],
      [
        "Выступление перемежается сюжетной вставкой: герой реагирует на смысл строки, камера ловит живую эмоцию без позы.",
        "Артист делает шаг к камере, свет раскрывает второй план, сюжетная деталь из текста появляется в руках или отражении.",
        "Камера видит артиста сбоку во время живого вокального прохода, фон становится активнее, но не забирает центр.",
      ],
      [
        "Артист поёт в полный голос, второй план раскрывается как сцена, свет и движение собирают кульминацию.",
        "Артист ведёт финальный припев, команда или музыканты появляются в широком кадре как поддержка.",
        "Артист завершает фразу крупным планом, затем камера отъезжает и показывает масштаб пространства.",
      ],
    ],
    journey: [
      [
        "Герой делает первый шаг из тесного пространства, оглядывается и выбирает направление.",
        "Герой касается стены, двери или холодного стекла, затем решительно выходит из кадра.",
        "Герой появляется в новом пространстве с паузой перед движением, как будто слышит зов песни.",
      ],
      [
        "Герой проходит новую локацию, преодолевает сопротивление среды и меняет темп движения.",
        "Герой идёт против ветра или потока людей, сохраняя направление и внутренний фокус.",
        "Герой ускоряется, локация становится шире, свет начинает работать как цель пути.",
      ],
      [
        "Герой выходит в открытое пространство и останавливается в сильной позе, показывая внутреннюю победу.",
        "Герой поднимает взгляд к источнику света, за спиной раскрывается весь путь.",
        "Герой делает последний шаг вперёд, камера оставляет его в большом финальном пространстве.",
      ],
    ],
    dance: [
      [
        "Лидер задаёт первый пластический мотив, остальные ещё неподвижны и ждут сигнала.",
        "Лидер делает короткий жест рукой и корпусом, танцоры отвечают едва заметным подготовительным движением.",
        "Лидер начинает движение с шага к камере, группа остаётся в тени и собирает внимание вокруг центра.",
      ],
      [
        "Группа подхватывает движение лидера, хореография строится слоями и подчёркивает ритм.",
        "Два ряда танцоров расходятся, лидер проходит между ними, движения становятся шире и резче.",
        "Хореография переходит из рук в корпус и шаги, камера следует за лидером без потери лица.",
      ],
      [
        "Все двигаются синхронно, лидер идёт вперёд, формация раскрывается в широкий финальный рисунок.",
        "Группа собирается в диагональ, лидер выходит на передний план и завершает движение сильной фиксацией.",
        "Финальный рисунок раскрывается вокруг лидера, камера поднимается и показывает масштаб хореографии.",
      ],
    ],
    symbolic: [
      [
        "Герой взаимодействует с предметом-символом: светом, тканью, водой, зеркалом или рукой в крупном плане.",
        "Герой подносит символический предмет к свету, камера показывает фактуру и отражение в глазах.",
        "Герой не объясняет эмоцию словами: смысл рождается через жест, предмет и паузу.",
      ],
      [
        "Предмет и герой связываются через действие, отражение или повтор жеста, смысл строки становится визуальным.",
        "Символ повторяется в другой форме: отражение, тень, линия ткани или блик на лице.",
        "Герой меняет положение предмета, и пространство вокруг становится визуально яснее.",
      ],
      [
        "Символ перестаёт быть деталью и становится центром финального кадра рядом с героем.",
        "Герой оставляет символ в кадре, а сам выходит к свету, создавая сильную финальную метафору.",
        "Символ, лицо и пространство собираются в один спокойный, дорогой, реалистичный кадр.",
      ],
    ],
    stage: [
      [
        "Backstage-подготовка переходит в первый вокальный вход: свет включается, герой занимает позицию.",
        "Артист выходит из тёмного прохода на сценический свет, слышен первый мощный вдох перед вокалом.",
        "Крупные детали сцены оживают: микрофон, кабель, рука на стойке, затем лицо артиста.",
      ],
      [
        "Камера идёт вокруг артиста и сцены, показывая реальное performance-действие и живую команду.",
        "Световики и музыканты двигаются на втором плане, артист держит центр и управляет энергией.",
        "Артист взаимодействует с краем сцены или площадки, камера соединяет лицо и масштаб.",
      ],
      [
        "Артист ведёт финальный припев, свет раскрывает площадку и создаёт ощущение большого выступления.",
        "Концертный свет открывает пространство, артист делает уверенный шаг вперёд и берёт пик фразы.",
        "Финал показывает артиста и площадку единым мощным образом, без хаотичного света.",
      ],
    ],
    ethno: [
      [
        "Герой появляется в современном локальном пространстве, культура читается через лица, фактуры и жесты.",
        "Герой проходит рядом с реальными деталями места, камера подчёркивает ткань, руки и свет без открытки.",
        "Первый вокальный жест соединяется с локальной фактурой: предмет, инструмент или архитектурная деталь.",
      ],
      [
        "Музыкант или танцор на втором плане отвечает на вокал, прошлое и настоящее соединяются без фэнтези.",
        "Второстепенный персонаж появляется сбоку, делает простой жест поддержки и остаётся в реалистичном фоне.",
        "Герой ведёт движение, а локальные детали становятся частью современного, живого пространства.",
      ],
      [
        "Группа и герой выходят в общий мощный кадр, локальная идентичность показана живо и уважительно.",
        "Финальный общий кадр собирает героя, людей и пространство без пафосной постановочности.",
        "Герой остаётся в центре, группа раскрывается сзади, свет делает культуру живой и современной.",
      ],
    ],
  };
  const stage = progress < 0.28 ? 0 : isPeak ? 2 : 1;
  const variants = actions[kind][stage] || actions[kind][0];
  return variants[index % variants.length] || variants[0];
}

function sceneCamera(kind: ReturnType<typeof ideaKind>, index: number, progress: number): string {
  const cameras: Record<ReturnType<typeof ideaKind>, string[]> = {
    performance: [
      "slow push-in from backstage detail to face, 50mm lens, stable cinematic movement",
      "handheld medium close-up around microphone, natural breathing motion, shallow depth of field",
      "wide stage reveal followed by tight hero close-up on the vocal accent",
      "over-the-shoulder shot from crew or band to the lead performer, smooth rack focus",
    ],
    journey: [
      "wide establishing shot with small hero figure, slow forward dolly",
      "tracking side shot following the walk, environment passing close to lens",
      "low angle hero frame, wind and space visible, camera rises slightly",
      "long lens compression through foreground objects, then clean close-up",
    ],
    dance: [
      "low tracking shot following feet and body rhythm, then snap to leader close-up",
      "wide formation shot with clear spacing, camera glides diagonally",
      "handheld orbit around leader and group, controlled energetic motion",
      "front-facing choreography shot, slight push-in on the strongest beat",
    ],
    symbolic: [
      "macro detail shot, slow rack focus from object to face",
      "static composed frame with subtle camera drift and negative space",
      "reflection shot through glass or water, then clean close-up",
      "top or profile angle that turns the symbol into a graphic shape",
    ],
    stage: [
      "backstage tracking shot past cables and lights toward the artist",
      "crane-like reveal from stage floor to face, cinematic concert energy",
      "long lens close-up through moving light beams, no chaotic flare",
      "wide crowd-or-city reveal, then hard cut to powerful close-up",
    ],
    ethno: [
      "respectful medium portrait with real environment behind, slow dolly in",
      "tracking shot along hands, fabric and faces, then return to lead singer",
      "wide cultural space reveal with lead in the center, stable composition",
      "low warm hero angle, natural background movement, no postcard framing",
    ],
  };
  const list = cameras[kind];
  return list[(index + Math.floor(progress * 10)) % list.length];
}

function enrichSceneAction(baseAction: string, blueprint: SceneBlueprint, label: string): string {
  const beat = blueprint.lyricBeat.replace(/[.!?]+$/g, "");
  return [
    baseAction,
    `Конкретика фрагмента «${label}»: действие строится в локации «${blueprint.location}» вокруг детали «${blueprint.foregroundDetail}» и смысла строки «${beat}».`,
    `Второй план: ${blueprint.supportingCast.toLowerCase()}.`,
  ].join(" ");
}

function sceneLighting(kind: ReturnType<typeof ideaKind>, progress: number): string {
  if (progress > 0.82) return "strong warm key light, golden highlights, deeper contrast, final-chorus intensity";
  if (progress > 0.55) return "balanced cinematic contrast, practical lights visible, warm accents on face and hands";
  const starts: Record<ReturnType<typeof ideaKind>, string> = {
    performance: "low backstage light, cool shadows, one warm practical near the face",
    journey: "cool dawn or night shadow, a thin warm edge light showing the direction forward",
    dance: "clean studio light with controlled contrast, floor reflections, energetic but realistic",
    symbolic: "soft natural light, careful highlights on object texture, muted background",
    stage: "pre-show darkness with controlled beams, no blown-out concert haze",
    ethno: "natural warm daylight or firelike practical light, real skin tones, restrained contrast",
  };
  return starts[kind];
}

function buildScenePrompt(
  input: VideoDirectorInput,
  idea: VideoDirectorIdea,
  label: string,
  visual: string,
  action: string,
  camera: string,
  lighting: string,
  blueprint: SceneBlueprint,
): string {
  const constraints = input.constraints
    ? `Mandatory constraints: ${input.constraints}.`
    : "Mandatory constraints: no random text, no logo, no watermark, do not change the lead character.";
  const refs = input.referenceNotes
    ? `Reference notes: ${input.referenceNotes}.`
    : "";
  return [
    `Ultra realistic cinematic video for ${input.targetModel || "AI video generator"}, ${input.visualStyle || idea.visualStyle}.`,
    `Scene ${label}, exact duration ${VIDEO_DIRECTOR_SEGMENT_SECONDS} seconds unless this is the final shorter fragment.`,
    `Lead character: ${blueprint.character}.`,
    `Wardrobe and continuity: ${blueprint.wardrobe}.`,
    `Location: ${blueprint.location}. World logic: ${idea.locations.join(", ")}.`,
    `Supporting cast/background: ${blueprint.supportingCast}.`,
    `Foreground detail: ${blueprint.foregroundDetail}.`,
    `Lyric or story beat to visualize: "${blueprint.lyricBeat}".`,
    `Visual composition: ${visual}.`,
    `Action: ${action}.`,
    `Camera: ${camera}.`,
    `Lighting and color: ${lighting}.`,
    `Transition to next fragment: ${blueprint.transition}.`,
    `Continuity rule: same face, same lead character, consistent costume family, consistent ethnicity and location logic.`,
    refs,
    constraints,
    `No subtitles or random screen text unless explicitly requested. High detail, natural skin, realistic motion, film still quality.`,
  ].filter(Boolean).join(" ");
}

export function fallbackStoryboard(
  input: VideoDirectorInput,
  analysis: VideoDirectorAnalysis,
  idea: VideoDirectorIdea,
  options: { sceneLimit?: number; startIndex?: number } = {},
): VideoDirectorScene[] {
  const count = getVideoDirectorSceneCount(input);
  const startIndex = Math.max(0, Math.min(count - 1, options.startIndex || 0));
  const limit = Math.max(1, options.sceneLimit || count);
  const endIndex = Math.min(count, startIndex + limit);
  const keyImages = analysis.keyImages.length ? analysis.keyImages : idea.locations;
  const lyricBeats = extractLyricBeats(input.sourceText);
  const kind = ideaKind(idea);
  return Array.from({ length: endIndex - startIndex }, (_, offset) => {
    const index = startIndex + offset;
    const startSec = index * VIDEO_DIRECTOR_SEGMENT_SECONDS;
    const endSec = Math.min(input.durationSec, startSec + VIDEO_DIRECTOR_SEGMENT_SECONDS);
    const progress = count === 1 ? 1 : index / (count - 1);
    const label = sceneLabel(input, analysis, index, count);
    const image = keyImages[index % keyImages.length] || "cinematic detail";
    const blueprint = buildSceneBlueprint(input, idea, lyricBeats, index, count);
    const visual =
      progress < 0.25
        ? `${blueprint.location}: первый план строится вокруг мотива «${image}», герой отделён от фона светом, видна деталь костюма.`
        : progress < 0.55
          ? `${blueprint.location}: мотив «${image}» связан с текущей строкой, второй план добавляет действие, но не спорит с героем.`
          : progress < 0.85
            ? `${blueprint.location}: кадр расширяется, мотив «${image}» становится эмоциональным центром, движение синхронизировано с музыкой.`
            : `${blueprint.location}: финальная версия мотива «${image}», герой, свет и пространство собираются в один сильный стоп-кадр.`;
    const action = enrichSceneAction(sceneAction(kind, progress, label, index), blueprint, label);
    const camera = sceneCamera(kind, index, progress);
    const lighting = sceneLighting(kind, progress);
    return sanitizeScene(input, {
      id: index + 1,
      startSec,
      endSec,
      label,
      purpose: scenePurpose(index, count, label, idea),
      visual,
      camera,
      lighting,
      action,
      prompt: buildScenePrompt(input, idea, label, visual, action, camera, lighting, blueprint),
      negativePrompt: FALLBACK_NEGATIVE,
    });
  });
}

async function callKimiJson(system: string, user: string, maxTokens: number): Promise<unknown | null> {
  try {
    const { callConfiguredLlmJson } = await import("@/lib/llm-runtime");
    return await callConfiguredLlmJson("video_director", system, user, maxTokens);
  } catch (e) {
    console.warn("[ai-video-director] LLM failed, using fallback", e);
    return null;
  }
}

function sanitizeIdea(input: VideoDirectorInput, idea: VideoDirectorIdea): VideoDirectorIdea {
  const locations = sanitizeGeneratedList(input, idea.locations);
  return {
    ...idea,
    title: sanitizeGeneratedText(input, idea.title),
    logline: sanitizeGeneratedText(input, idea.logline),
    visualStyle: sanitizeGeneratedText(input, idea.visualStyle),
    locations: locations.length ? locations : deriveLocationsFromText(input, { ...fallbackAnalysis(input), keyImages: [] }),
    whyItFits: sanitizeGeneratedText(input, idea.whyItFits),
    rules: sanitizeGeneratedList(input, idea.rules),
  };
}

function sanitizeScene(input: VideoDirectorInput, scene: VideoDirectorScene): VideoDirectorScene {
  return {
    ...scene,
    label: sanitizeGeneratedText(input, scene.label),
    purpose: sanitizeGeneratedText(input, scene.purpose),
    visual: sanitizeGeneratedText(input, scene.visual),
    camera: sanitizeGeneratedText(input, scene.camera),
    lighting: sanitizeGeneratedText(input, scene.lighting),
    action: sanitizeGeneratedText(input, scene.action),
    prompt: sanitizeGeneratedText(input, scene.prompt),
    negativePrompt: sanitizeGeneratedText(input, scene.negativePrompt),
  };
}

function coerceIdeasPayload(input: VideoDirectorInput, raw: unknown, fallback: IdeasPayload): IdeasPayload {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const rawAnalysis = typeof obj.analysis === "object" && obj.analysis ? obj.analysis as Record<string, unknown> : {};
  const analysis: VideoDirectorAnalysis = {
    language: sanitizeGeneratedText(input, cleanText(rawAnalysis.language, fallback.analysis.language, 80)),
    mood: sanitizeGeneratedText(input, cleanText(rawAnalysis.mood, fallback.analysis.mood, 220)),
    energy: sanitizeGeneratedText(input, cleanText(rawAnalysis.energy, fallback.analysis.energy, 160)),
    structure: sanitizeGeneratedList(input, compactList(rawAnalysis.structure, 12).length ? compactList(rawAnalysis.structure, 12) : fallback.analysis.structure),
    keyImages: sanitizeGeneratedList(input, compactList(rawAnalysis.keyImages, 8).length ? compactList(rawAnalysis.keyImages, 8) : fallback.analysis.keyImages),
    directorNote: sanitizeGeneratedText(input, cleanText(rawAnalysis.directorNote, fallback.analysis.directorNote, 400)),
  };

  const rawIdeas = Array.isArray(obj.ideas) ? obj.ideas : [];
  const ideas = rawIdeas.slice(0, 5).map((item, idx) => {
    const idea = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const fb = fallback.ideas[idx] || fallback.ideas[0];
    return sanitizeIdea(input, {
      id: normalizeIdeaId(idea.id) || fb.id || `idea-${idx + 1}`,
      title: cleanText(idea.title, fb.title, 80),
      logline: cleanText(idea.logline, fb.logline, 360),
      visualStyle: cleanText(idea.visualStyle, fb.visualStyle, 180),
      locations: compactList(idea.locations, 5).length ? compactList(idea.locations, 5) : fb.locations,
      whyItFits: cleanText(idea.whyItFits, fb.whyItFits, 260),
      rules: compactList(idea.rules, 5).length ? compactList(idea.rules, 5) : fb.rules,
    });
  });

  return { analysis, ideas: ideas.length === 5 ? ideas : fallback.ideas };
}

function normalizedSignature(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function uniqueRatio(values: string[]): number {
  if (values.length <= 1) return 1;
  const unique = new Set(values.map(normalizedSignature).filter(Boolean));
  return unique.size / values.length;
}

function hasWeakSceneDiversity(scenes: VideoDirectorScene[]): boolean {
  if (scenes.length < 4) return false;
  const actionRatio = uniqueRatio(scenes.map((scene) => scene.action));
  const visualRatio = uniqueRatio(scenes.map((scene) => scene.visual));
  const promptRatio = uniqueRatio(scenes.map((scene) => scene.prompt.slice(0, 260)));
  return actionRatio < 0.35 || (visualRatio < 0.45 && promptRatio < 0.45);
}

function coerceScenes(input: VideoDirectorInput, raw: unknown, fallback: VideoDirectorScene[]): VideoDirectorScene[] {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const rawScenes = Array.isArray(obj.scenes) ? obj.scenes : [];
  if (rawScenes.length < Math.min(2, fallback.length)) return fallback;
  const scenes = fallback.map((fb, idx) => {
    const scene = typeof rawScenes[idx] === "object" && rawScenes[idx] ? rawScenes[idx] as Record<string, unknown> : {};
    return sanitizeScene(input, {
      ...fb,
      label: cleanText(scene.label, fb.label, 80),
      purpose: cleanText(scene.purpose, fb.purpose, 240),
      visual: cleanText(scene.visual, fb.visual, 700),
      camera: cleanText(scene.camera, fb.camera, 300),
      lighting: cleanText(scene.lighting, fb.lighting, 300),
      action: cleanText(scene.action, fb.action, 500),
      prompt: cleanText(scene.prompt, fb.prompt, 1800),
      negativePrompt: cleanText(scene.negativePrompt, fb.negativePrompt, 800),
    });
  });
  return hasWeakSceneDiversity(scenes) ? fallback : scenes;
}

export async function generateVideoDirectorIdeas(input: VideoDirectorInput): Promise<IdeasPayload> {
  const fallback = (() => {
    const analysis = fallbackAnalysis(input);
    return { analysis, ideas: fallbackIdeas(input, analysis) };
  })();

  const raw = await callKimiJson(
    "Ты AI режиссёр музыкальных клипов и кино. Возвращай только валидный JSON без markdown. Не используй готовые примеры, реальные города, страны, площадки, бренды, культурные институции или этнический контекст, если пользователь явно не указал их в тексте, локациях или референсах.",
    `Проанализируй материал и предложи 5 разных режиссёрских концепций.

Верни JSON строго такого вида:
{
  "analysis": {
    "language": "язык материала",
    "mood": "эмоциональная дуга",
    "energy": "темп/энергия",
    "structure": ["Интро", "Куплет", "Припев"],
    "keyImages": ["ключевой образ"],
    "directorNote": "главное режиссёрское правило"
  },
  "ideas": [
    {
      "id": "latin-id",
      "title": "короткое название",
      "logline": "суть клипа или сцены",
      "visualStyle": "реалистичный визуальный стиль",
      "locations": ["локация"],
      "whyItFits": "почему подходит материалу",
      "rules": ["правило консистентности"]
    }
  ]
}

Режим: ${input.mode === "clip" ? "клип по песне" : "сцена фильма"}.
Название: ${input.title || "не указано"}.
Длительность: ${input.durationSec} секунд.
Вокал/герой: ${input.vocalProfile || "не указано"}.
Энергия: ${input.energy || "определи по тексту"}.
${audioAnalysisPrompt(input)}
Стиль: ${input.visualStyle}.
Локации: ${locationsPrompt(input)}.
Референсы: ${input.referenceNotes || "нет"}.
Запреты: ${input.constraints || "без случайного текста, без лишних персонажей, без смены лица главного героя"}.

Grounding rules:
- referenceNotes и constraints являются production bible: это жёсткие правила для героя, костюма, локаций, камеры, запретов и continuity;
- если локации не заданы явно, не используй дефолтные города/улицы/сцены, а выводи мир только из материала;
- опирайся только на текст песни/описание, локации, референсы, аудио-анализ и выбранный режим;
- не добавляй реальные географические места, регионы, города, площади, школы, фестивали, бренды или вывески, если пользователь не написал их явно;
- если слово выглядит как имя/миф/образ песни, трактуй его как образ внутри мира клипа, а не как повод добавлять реальные места;
- каждая идея должна объяснять, какие строки или образы текста она визуализирует;
- локации должны быть универсальными production-локациями по смыслу: "пространство камней", "тёмный зал", "световой выход", "площадка танца", а не реальные адреса.

Материал:
"""${input.sourceText}"""`,
    2200,
  );

  return coerceIdeasPayload(input, raw, fallback);
}

export async function generateVideoDirectorStoryboard(
  input: VideoDirectorInput,
  analysis: VideoDirectorAnalysis,
  idea: VideoDirectorIdea,
  options: { sceneLimit?: number; startIndex?: number } = {},
): Promise<VideoDirectorScene[]> {
  const fallback = fallbackStoryboard(input, analysis, idea, options);
  const totalScenes = getVideoDirectorSceneCount(input);
  const startIndex = options.startIndex || 0;
  const endIndex = startIndex + fallback.length;
  const raw = await callKimiJson(
    "Ты AI режиссёр и промпт-инженер для видеогенераторов. Возвращай только валидный JSON без markdown. Все сцены должны быть grounded: только текст, выбранная идея, локации и референсы пользователя. Не добавляй реальные места, бренды или культурный контекст из ассоциаций.",
    `Создай раскадровку по ${VIDEO_DIRECTOR_SEGMENT_SECONDS} секунд для выбранной концепции. Последний фрагмент может быть короче.
Нужно сгенерировать сцены ${startIndex + 1}-${endIndex} из ${totalScenes}.

Верни JSON строго такого вида:
{
  "scenes": [
    {
      "label": "секция или драматический beat",
      "purpose": "зачем нужна сцена",
      "visual": "что видно в кадре",
      "camera": "тип кадра и движение камеры",
      "lighting": "свет и цвет",
      "action": "действие персонажей",
      "prompt": "готовый реалистичный промпт для видеогенерации",
      "negativePrompt": "что исключить"
    }
  ]
}

Важно:
- сцен должно быть ровно ${fallback.length};
- таймкоды должны соответствовать сценам ${startIndex + 1}-${endIndex}, не начинай заново с нуля, если это не первая сцена;
- referenceNotes и constraints считай production bible, а не подсказкой: они фиксируют героя, костюм, локации, камеру, запреты и continuity;
- если локации пользователя не заданы явно, выводи каждую локацию только из текста/описания и выбранной идеи, без внешних ассоциаций;
- не добавляй титры и текст на экране, если пользователь не просит;
- держи одинакового главного героя и стиль во всех сценах;
- промпты должны быть максимально реалистичными, production-ready;
- каждый prompt обязан содержать конкретные настройки героя: внешний образ, костюм/гардероб, роль второго плана, точную локацию текущего фрагмента и действие именно этих 10 секунд;
- нельзя повторять один и тот же action/prompt с заменой только камеры; если сцены похожи, JSON считается плохим;
- для локальных культурных образов избегай карикатуры и случайной этничности;
- если указаны референсы, сохраняй место, вывески, число героев и композицию.
- запрещено добавлять реальные географические места, города, регионы, известные площадки, школы, бренды и вывески, если их нет во вводе;
- если в тексте есть имя/образ, используй его как часть вымышленного мира клипа, не достраивай вокруг него реальную географию;
- каждая сцена должна явно визуализировать конкретную строку, повтор, образ или музыкальный beat из материала.

Режим: ${input.mode}.
Длительность: ${input.durationSec} секунд.
${audioAnalysisPrompt(input)}
Вокал/герой: ${input.vocalProfile || "не указано"}.
Выбранная идея: ${idea.title} — ${idea.logline}.
Стиль идеи: ${idea.visualStyle}.
Локации: ${idea.locations.join(", ")}.
Правила идеи: ${idea.rules.join("; ")}.
Референсы: ${input.referenceNotes || "нет"}.
Запреты: ${input.constraints || "нет"}.
Текст/описание:
"""${input.sourceText}"""`,
    Math.min(12000, 1400 + fallback.length * 420),
  );

  return coerceScenes(input, raw, fallback);
}

export function makeVideoDirectorProject(
  input: VideoDirectorInput,
  analysis: VideoDirectorAnalysis,
  ideas: VideoDirectorIdea[],
  selectedIdea: VideoDirectorIdea,
  scenes: VideoDirectorScene[],
): VideoDirectorProject {
  return {
    projectId: randomUUID(),
    input,
    analysis,
    ideas,
    selectedIdea,
    scenes,
    totalScenes: getVideoDirectorSceneCount(input),
    createdAt: new Date().toISOString(),
  };
}

export function projectToMongoDoc(project: VideoDirectorProject): Record<string, unknown> {
  return {
    _id: project.projectId,
    input: project.input,
    analysis: project.analysis,
    ideas: project.ideas,
    selectedIdea: project.selectedIdea,
    scenes: project.scenes,
    total_scenes: project.totalScenes,
    status: "storyboard",
    created_at: new Date(project.createdAt),
    updated_at: new Date(),
  };
}

export function projectFromMongoDoc(doc: Record<string, unknown>): VideoDirectorProject | null {
  if (!doc?._id || !doc.input || !doc.analysis || !doc.selectedIdea || !Array.isArray(doc.scenes)) {
    return null;
  }
  return {
    projectId: String(doc._id),
    input: doc.input as VideoDirectorInput,
    analysis: doc.analysis as VideoDirectorAnalysis,
    ideas: Array.isArray(doc.ideas) ? doc.ideas as VideoDirectorIdea[] : [],
    selectedIdea: doc.selectedIdea as VideoDirectorIdea,
    scenes: doc.scenes as VideoDirectorScene[],
    totalScenes: Math.max(
      Number(doc.total_scenes || 0),
      Array.isArray(doc.scenes) ? doc.scenes.length : 0,
      getVideoDirectorSceneCount(doc.input as VideoDirectorInput),
    ),
    createdAt: doc.created_at instanceof Date ? doc.created_at.toISOString() : new Date().toISOString(),
  };
}
