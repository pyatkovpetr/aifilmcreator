import type {
  PublicVideoDirectorProject,
  VideoDirectorProject,
  VideoDirectorScene,
} from "@/lib/ai-video-director";

export const VIDEO_DIRECTOR_MODEL_VARIANTS = [
  { id: "master", label: "Master", hint: "универсальный prompt" },
  { id: "kling", label: "Kling", hint: "движение и физика кадра" },
  { id: "veo", label: "Veo", hint: "story logic и continuity" },
  { id: "runway", label: "Runway", hint: "короткая визуальная команда" },
  { id: "seedance", label: "Seedance", hint: "ритм, динамика, temporal consistency" },
] as const;

export const VIDEO_DIRECTOR_QUICK_ACTIONS = [
  { id: "premium", label: "Сделать дороже", hint: "production design" },
  { id: "motion", label: "Больше движения", hint: "action + camera" },
  { id: "closeup", label: "Больше close-up", hint: "лицо и эмоция" },
  { id: "kling", label: "Упростить для Kling", hint: "ясное действие" },
] as const;

export const VIDEO_DIRECTOR_REFERENCE_SLOTS = [
  { id: "hero", label: "Фото героя", hint: "лицо, силуэт, возраст" },
  { id: "location", label: "Фото локации", hint: "пространство и свет" },
  { id: "costume", label: "Костюм", hint: "одежда и цвет" },
  { id: "props", label: "Реквизит", hint: "предметы сцены" },
] as const;

export type VideoDirectorModelVariantId = typeof VIDEO_DIRECTOR_MODEL_VARIANTS[number]["id"];
export type VideoDirectorQuickActionId = typeof VIDEO_DIRECTOR_QUICK_ACTIONS[number]["id"];
export type VideoDirectorReferenceSlotId = typeof VIDEO_DIRECTOR_REFERENCE_SLOTS[number]["id"];

export type ProductionBibleAsset = {
  id: string;
  label: string;
  value: string;
  status: "ready" | "draft" | "missing";
};

export type ProductionBibleBeat = {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  energy: "low" | "mid" | "high" | "peak";
  goal: string;
};

export type ProductionBibleShot = {
  id: string;
  label: string;
  frame: string;
  action: string;
  camera: string;
  lighting: string;
};

export type ProductionBible = {
  readiness: ProductionBibleAsset[];
  characters: ProductionBibleAsset[];
  locations: ProductionBibleAsset[];
  costumes: ProductionBibleAsset[];
  props: ProductionBibleAsset[];
  motifs: ProductionBibleAsset[];
  forbidden: ProductionBibleAsset[];
  beats: ProductionBibleBeat[];
};

type BibleProject = Pick<VideoDirectorProject | PublicVideoDirectorProject, "input" | "analysis" | "selectedIdea" | "scenes" | "totalScenes">;

function splitLooseList(value: string, fallback: string[] = []): string[] {
  const items = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function hasExplicitLocationList(value: string): boolean {
  const clean = value.trim();
  if (!clean) return false;
  return !/определи|предложи|по смыслу|из текста|главная локация|пространство перехода/i.test(clean);
}

function truncate(value: string, max = 260): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function formatBibleTimestamp(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}

function asset(id: string, label: string, value: string, fallback: string, ready = Boolean(value.trim())): ProductionBibleAsset {
  return {
    id,
    label,
    value: truncate(value || fallback),
    status: ready ? "ready" : "draft",
  };
}

function readinessStatus(label: string, ready: boolean, value: string): ProductionBibleAsset {
  return {
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    value,
    status: ready ? "ready" : "missing",
  };
}

function energyForBeat(label: string, index: number, count: number): ProductionBibleBeat["energy"] {
  const lower = label.toLowerCase();
  if (/припев|chorus|финал|final|кульминац|peak/.test(lower)) return index >= count - 1 ? "peak" : "high";
  if (/bridge|бридж|turn|поворот/.test(lower)) return "high";
  if (index === 0 || /intro|интро/.test(lower)) return "low";
  return "mid";
}

function beatGoal(mode: string, label: string, energy: ProductionBibleBeat["energy"]): string {
  if (mode === "film") {
    if (energy === "low") return "Задать пространство, героев и скрытое напряжение.";
    if (energy === "peak") return "Закрыть сцену выбором, раскрытием или сильной паузой.";
    if (energy === "high") return "Усилить конфликт и сменить власть внутри сцены.";
    return "Продвинуть действие через взгляд, предмет или реплику без случайных кадров.";
  }
  if (/припев|chorus/i.test(label)) return "Собрать максимум вокальной энергии, движения и узнаваемый performance-кадр.";
  if (energy === "peak") return "Сделать финальный стоп-кадр, который продаёт клип.";
  if (energy === "low") return "Ввести героя, мир и главный визуальный мотив.";
  return "Развить путь героя и подготовить следующий музыкальный акцент.";
}

export function buildProductionBible(project: BibleProject): ProductionBible {
  const input = project.input;
  const characterLabel = input.mode === "clip" ? "Главный исполнитель" : "Герои сцены";
  const locations = hasExplicitLocationList(input.locations)
    ? splitLooseList(input.locations, project.selectedIdea.locations)
    : project.selectedIdea.locations;
  const constraints = splitLooseList(input.constraints, ["без случайного текста", "без смены лица", "без логотипов"]);
  const motifs = project.analysis.keyImages.length ? project.analysis.keyImages : ["свет", "движение", "эмоциональный пик"];
  const sections = project.analysis.structure.length
    ? project.analysis.structure
    : input.mode === "clip"
      ? ["Интро", "Куплет", "Припев", "Финал"]
      : ["Завязка", "Конфликт", "Поворот", "Финал"];
  const duration = Math.max(1, input.durationSec);

  const beats = sections.map((label, index) => {
    const startSec = Math.round((duration / sections.length) * index);
    const endSec = index === sections.length - 1 ? duration : Math.round((duration / sections.length) * (index + 1));
    const energy = energyForBeat(label, index, sections.length);
    return {
      id: `beat-${index + 1}`,
      label,
      startSec,
      endSec,
      energy,
      goal: beatGoal(input.mode, label, energy),
    };
  });

  const hasHero = input.vocalProfile.trim().length > 16;
  const hasLocations = locations.length > 0;
  const hasRefs = input.referenceNotes.trim().length > 12;
  const hasCamera = /камера|camera|линз|lens|оператор|handheld|wide|tracking|close/i.test(input.referenceNotes + input.visualStyle);
  const hasConstraints = constraints.length > 0;

  return {
    readiness: [
      readinessStatus("Герой зафиксирован", hasHero, hasHero ? "character bank готов" : "нужно описать героя"),
      readinessStatus("Локации заданы", hasLocations, hasLocations ? `${locations.length} локации` : "нужно задать мир"),
      readinessStatus("Камера выбрана", hasCamera, hasCamera ? "есть операторское правило" : "можно выбрать пресет"),
      readinessStatus("Референсы есть", hasRefs, hasRefs ? "reference notes заполнены" : "можно добавить фото/описание"),
      readinessStatus("Запреты заданы", hasConstraints, hasConstraints ? "continuity защищён" : "нужны negative rules"),
    ],
    characters: [
      asset("lead", characterLabel, input.vocalProfile, "Один центральный герой, same face, same costume family, readable emotion arc.", hasHero),
    ],
    locations: locations.slice(0, 5).map((location, index) =>
      asset(`location-${index + 1}`, `Локация ${index + 1}`, location, "реальная локация с понятным светом", true),
    ),
    costumes: [
      asset("costume-main", "Костюм/силуэт", input.referenceNotes, "единая костюмная база, без случайной смены лица и образа", hasRefs),
    ],
    props: [
      asset("prop-main", "Реквизит", motifs.slice(0, 3).join(", "), "предметы, которые повторяются и связывают сцены", true),
    ],
    motifs: motifs.slice(0, 6).map((motif, index) =>
      asset(`motif-${index + 1}`, `Мотив ${index + 1}`, motif, "визуальный мотив", true),
    ),
    forbidden: constraints.slice(0, 8).map((rule, index) =>
      asset(`rule-${index + 1}`, `Запрет ${index + 1}`, rule, "negative continuity rule", true),
    ),
    beats,
  };
}

export function buildSceneShotPlan(scene: VideoDirectorScene): ProductionBibleShot[] {
  return [
    {
      id: "wide",
      label: "Wide / establishing",
      frame: scene.visual,
      action: "Показать пространство, позицию героя и первый визуальный мотив сцены.",
      camera: scene.camera,
      lighting: scene.lighting,
    },
    {
      id: "hero",
      label: "Hero action",
      frame: "Средний или крупный план, лицо и действие героя остаются читаемыми.",
      action: scene.action,
      camera: "medium close-up or tracking shot, keep the same face and costume continuity",
      lighting: scene.lighting,
    },
    {
      id: "transition",
      label: "Cut / transition",
      frame: "Деталь, жест, световой блик или движение камеры для перехода в следующий фрагмент.",
      action: buildSceneTransitionNote(scene),
      camera: "match cut, whip pan, rack focus or clean cut depending on music beat",
      lighting: "match color and contrast with the next scene",
    },
  ];
}

export function buildSceneTransitionNote(scene: VideoDirectorScene, nextScene?: VideoDirectorScene): string {
  const next = nextScene ? ` Следующий кадр начинается с «${nextScene.label}» (${formatBibleTimestamp(nextScene.startSec)}).` : "";
  const match = scene.prompt.match(/Transition to next fragment:\s*([^.]*(?:\.[^A-ZА-Я]*)?)/i);
  const transition = match?.[1]?.trim() || "Закончить фрагмент движением, взглядом или световым акцентом, который можно смонтировать в следующую сцену.";
  return `${transition}${next}`.trim();
}

export function buildModelPromptVariant(
  scene: VideoDirectorScene,
  project: BibleProject,
  modelId: VideoDirectorModelVariantId,
): string {
  if (modelId === "master") return scene.prompt;
  const base = scene.prompt;
  const continuity = `Keep the production bible continuity: ${project.input.vocalProfile}. Locations: ${project.input.locations}. Do not change face, costume family, ethnicity or screen geography.`;
  const adapters: Record<Exclude<VideoDirectorModelVariantId, "master">, string> = {
    kling: "Kling adapter: describe one clear physical action, readable camera movement, concrete start and end pose, no abstract symbolism without visible action.",
    veo: "Veo adapter: prioritize story logic, cause-and-effect blocking, emotional continuity, realistic acting beats and coherent transitions between shots.",
    runway: "Runway adapter: make the prompt concise and visual; foreground subject, environment, action, camera, lighting, negative text constraints.",
    seedance: "Seedance adapter: emphasize temporal consistency, rhythm, body movement, stable identity, smooth motion and clean transition.",
  };
  return `${base} ${adapters[modelId]} ${continuity}`;
}

export function buildModelPromptAdapters(): Array<{ id: Exclude<VideoDirectorModelVariantId, "master">; label: string; value: string }> {
  return [
    { id: "kling", label: "Kling", value: "Оставить одно ясное физическое действие, читаемую траекторию камеры, стартовую и финальную позу." },
    { id: "veo", label: "Veo", value: "Усилить причинность, актёрский beat, continuity героя и логичный переход к следующему кадру." },
    { id: "runway", label: "Runway", value: "Сжать prompt до subject + location + action + camera + light + constraints." },
    { id: "seedance", label: "Seedance", value: "Добавить ритм движения, temporal consistency, стабильное лицо и плавную динамику." },
  ];
}

export function applyScenePromptQuickAction(prompt: string, actionId: VideoDirectorQuickActionId): string {
  const additions: Record<VideoDirectorQuickActionId, string> = {
    premium: "Production upgrade: richer art direction, premium lighting, intentional production design, realistic high-budget texture, no random decorative clutter.",
    motion: "Motion upgrade: add one clear body movement, one camera movement, and a readable start-to-end action arc within the 10-second fragment.",
    closeup: "Close-up upgrade: include a controlled expressive close-up on the face, hands or prop, with natural skin and emotional micro-gesture.",
    kling: "Kling simplification: one main subject, one location, one physical action, clear camera path, concrete beginning and ending pose.",
  };
  const addition = additions[actionId];
  return prompt.includes(addition) ? prompt : `${prompt} ${addition}`;
}
