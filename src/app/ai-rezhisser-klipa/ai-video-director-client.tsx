"use client";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  FileText,
  Film,
  FolderOpen,
  Grid2X2,
  GripVertical,
  Lightbulb,
  Loader2,
  LayoutGrid,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  MessageSquareText,
  Music2,
  Search,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  UserRound,
  Wand2,
} from "lucide-react";
import { useAuth, useAuthModal } from "@/lib/standalone-auth";
import { apiFetch, getAuthHeaders, ANALYZE_MAX_FILE_BYTES, largeAudioFileMessage, AI_VIDEO_DIRECTOR_DRAFT_STORAGE_KEY } from "@/lib/standalone-client";
import { LearningModeToggle } from "@/components/learning/learning-mode-toggle";
import {
  VIDEO_DIRECTOR_MODEL_VARIANTS,
  VIDEO_DIRECTOR_QUICK_ACTIONS,
  VIDEO_DIRECTOR_REFERENCE_SLOTS,
  applyScenePromptQuickAction,
  buildModelPromptVariant,
  buildProductionBible,
  buildSceneShotPlan,
  buildSceneTransitionNote,
  type VideoDirectorModelVariantId,
  type VideoDirectorQuickActionId,
  type VideoDirectorReferenceSlotId,
} from "@/lib/ai-video-director-production-bible";
import { cn } from "@/lib/utils";
import {
  normalizeVideoDirectorDuration,
  VIDEO_DIRECTOR_MAX_DURATION_SEC,
  VIDEO_DIRECTOR_MIN_DURATION_SEC,
} from "@/lib/ai-video-director-contract";
import type {
  PublicVideoDirectorProject,
  VideoDirectorAnalysis,
  VideoDirectorAudioAnalysis,
  VideoDirectorIdea,
  VideoDirectorMode,
  VideoDirectorScene,
} from "@/lib/ai-video-director";
import { TTS_VOICES } from "@/lib/tts-voices";

const YooKassaWidget = lazy(() =>
  import("@/components/billing/yookassa-widget").then((m) => ({
    default: m.YooKassaWidget,
  })),
);

function useVkPurchaseRestriction() { return false; }
const VK_DIGITAL_PURCHASE_NOTICE = "В standalone-версии production pack открывается локальным demo-доступом.";

const PRICE_RUB = 149;
const TOKEN_COST = 5;

type IdeasResponse = {
  sessionId: string;
  analysis: VideoDirectorAnalysis;
  ideas: VideoDirectorIdea[];
  error?: string;
};

type FormState = {
  mode: VideoDirectorMode;
  title: string;
  sourceText: string;
  durationSec: number;
  vocalProfile: string;
  energy: string;
  visualStyle: string;
  locations: string;
  referenceNotes: string;
  constraints: string;
  targetModel: string;
  audioAnalysis?: VideoDirectorAudioAnalysis;
};

type AiVideoDirectorClientProps = {
  embedded?: boolean;
  initialAudioTaskId?: string;
  initialAudioFileName?: string;
};

type SavedDirectorProject = {
  projectId: string;
  title: string;
  mode: VideoDirectorMode;
  selectedIdeaTitle: string;
  scenesReady: number;
  totalScenes: number;
  complete: boolean;
  updatedAt: string | null;
  createdAt: string | null;
};

type DirectorLibraryItem = {
  id: string;
  title: string;
  subtitle: string;
  scenes: string;
  kind: "клип" | "фильм";
  gradient: string;
  sourceText?: string;
};

const DIRECTOR_LIBRARY_EXAMPLES: DirectorLibraryItem[] = [
  { id: "new-shores", title: "К новым берегам", subtitle: "Performance + смысл текста", scenes: "2/2", kind: "клип", gradient: "radial-gradient(circle at 72% 24%, rgba(254,215,170,.96), transparent 26%), linear-gradient(135deg, #2b1747 0%, #692f70 46%, #ee7e5d 100%)" },
  { id: "glass-labyrinth", title: "Ночной город", subtitle: "Стеклянный лабиринт", scenes: "2/2", kind: "клип", gradient: "radial-gradient(circle at 20% 18%, rgba(125,211,252,.8), transparent 26%), linear-gradient(135deg, #071832 0%, #164e63 48%, #7c3aed 100%)" },
  { id: "glass-mirrors", title: "Ночной город", subtitle: "Стеклянные зеркала", scenes: "18/18", kind: "клип", gradient: "radial-gradient(circle at 68% 34%, rgba(244,114,182,.86), transparent 21%), linear-gradient(135deg, #111827 0%, #3b0764 52%, #be185d 100%)" },
  { id: "reality-mirror", title: "Ночной город", subtitle: "Разбитое зеркало реальности", scenes: "2/3", kind: "клип", gradient: "radial-gradient(circle at 48% 35%, rgba(226,232,240,.92), transparent 18%), linear-gradient(135deg, #0f172a 0%, #334155 52%, #64748b 100%)" },
  { id: "hero-path", title: "Ночной город", subtitle: "Путь героя", scenes: "2/18", kind: "клип", gradient: "radial-gradient(circle at 75% 18%, rgba(251,191,36,.9), transparent 20%), linear-gradient(135deg, #172554 0%, #312e81 48%, #f59e0b 100%)" },
  { id: "symbolic-realism", title: "Ночной город", subtitle: "Символический реализм", scenes: "2/19", kind: "клип", gradient: "radial-gradient(circle at 28% 24%, rgba(134,239,172,.8), transparent 24%), linear-gradient(135deg, #052e16 0%, #166534 49%, #0f766e 100%)" },
  { id: "er-saqchysy-light", title: "er_saqchysy", subtitle: "Выход к свету", scenes: "2/19", kind: "клип", gradient: "radial-gradient(circle at 52% 30%, rgba(253,224,71,.94), transparent 22%), linear-gradient(135deg, #172554 0%, #0369a1 48%, #fde047 100%)" },
  { id: "er-saqchysy-ritual", title: "er_saqchysy", subtitle: "Обряд света в репетиции", scenes: "2/19", kind: "клип", gradient: "radial-gradient(circle at 65% 25%, rgba(251,146,60,.92), transparent 25%), linear-gradient(135deg, #1c1917 0%, #7c2d12 48%, #ea580c 100%)" },
  { id: "er-saqchysy-voice", title: "er_saqchysy", subtitle: "Древний голос в современном городе", scenes: "2/19", kind: "клип", gradient: "radial-gradient(circle at 32% 26%, rgba(165,243,252,.9), transparent 24%), linear-gradient(135deg, #083344 0%, #155e75 48%, #0e7490 100%)" },
];

type RenderJob = {
  status: "queued" | "running" | "completed" | "failed";
  stage?: string;
  jobId: string;
  projectId: string;
  totalScenes?: number;
  completedScenes?: number;
  finalUrl?: string;
  error?: string;
};

type AnalyzeResult = {
  duration?: number;
  bpm?: number;
  key?: string;
  mode?: string;
  lufs_integrated?: number;
};

const CLIP_SAMPLE_SOURCE = `[Intro]
Ночной город дышит тише,
Я иду на свет витрин.

[Verse 1]
В каждом окне чужие роли,
В каждом шаге новый ритм.
Я собираю голос в силу,
Чтобы снова быть живым.

[Chorus]
Выше, выше, выше к свету,
Пусть весь город слышит нас.
Мы выходим из тумана,
Начинается сейчас.`;

const FILM_SAMPLE_SOURCE = `Интерьер старого лифта в бизнес-центре поздним вечером. Два героя застряли между этажами: молодая дизайнерка пытается сохранить спокойствие, а её бывший продюсер впервые говорит правду о сорванном проекте. Свет мигает, телефон не ловит сеть, за дверью слышны далёкие шаги охраны.

В начале сцены они держат дистанцию и говорят сухо. Затем напряжение растёт: героиня замечает у продюсера папку с её эскизами, которую он обещал уничтожить. К середине сцены появляется выбор: обвинить его или узнать, зачем он вернул папку. Финал тихий, но сильный: лифт открывается, героиня выходит первой, а продюсер остаётся внутри с решением, которое меняет их дальнейший путь.`;

const CLIP_DEFAULT_FORM: FormState = {
  mode: "clip",
  title: "Ночной город",
  sourceText: "",
  durationSec: 180,
  vocalProfile: "девушка lead vocal, сильный эмоциональный голос, один центральный образ",
  energy: "мощная, современная, растёт к припевам",
  visualStyle: "максимально реалистичный кинематографичный live action",
  locations: "определи из текста песни: главная локация, performance-пространство, пространство перехода, финальный общий кадр",
  referenceNotes: "Натуральные лица, дорогой свет, цельный образ героя, визуальные мотивы брать только из текста и пользовательских референсов.",
  constraints: "без логотипов и водяных знаков; без случайного текста на экране; не менять лицо и костюм главного героя; не добавлять реальные места, если их нет во вводе",
  targetModel: "Kling / Veo / Runway / Seedance",
};

const FILM_DEFAULT_FORM: FormState = {
  ...CLIP_DEFAULT_FORM,
  mode: "film",
  title: "Сцена в лифте",
  vocalProfile: "два героя: уверенная молодая дизайнерка и бывший продюсер, реалистичная актёрская игра, сильные крупные планы",
  energy: "напряжённая, камерная, растёт через паузы и взгляды",
  visualStyle: "киношная сцена фильма, handheld и close-ups, реалистичный драматический свет",
  locations: "старый лифт, узкий коридор бизнес-центра, вечерний холл",
  referenceNotes: "Акцент на лицах, паузах, взглядах, руках и тесном пространстве.",
  constraints: "без случайного текста на экране; без смены лиц; без лишних персонажей; без логотипов",
};

const MODEL_OPTIONS = [
  "Kling / Veo / Runway / Seedance",
  "Kling",
  "Google Veo",
  "Runway",
  "Seedance",
  "Универсальный видеогенератор",
];

const STYLE_OPTIONS = [
  "максимально реалистичный кинематографичный live action",
  "современный urban cinematic, натуральный свет",
  "дорогой performance clip, студия и крупные планы",
  "поэтический реализм без фэнтези",
  "киношная сцена фильма, handheld и close-ups",
];

type DirectorTemplate = {
  id: string;
  label: string;
  energy: string;
  visualStyle: string;
  locations: string;
  referenceNotes: string;
  constraints: string;
};

type CharacterPreset = {
  id: string;
  label: string;
  hint: string;
  profile: string;
  referenceNotes: string;
  constraints: string;
};

type CinematographyPreset = {
  id: string;
  label: string;
  hint: string;
  camera: string;
  lens: string;
  lighting: string;
  visualStyle: string;
  referenceNotes: string;
  constraints: string;
};

type ProductionBibleRulePreset = {
  id: string;
  label: string;
  hint: string;
  referenceNotes?: string;
  constraints?: string;
  energy?: string;
};

type PreGenerationReadinessItem = {
  id: string;
  label: string;
  value: string;
  ready: boolean;
};

const CLIP_DIRECTOR_TEMPLATES: DirectorTemplate[] = [
  {
    id: "ethno",
    label: "Этно-клип",
    energy: "эпическая, гордая, растёт к общему финалу",
    visualStyle: "реалистичный этно-cinematic без фэнтези-перегруза, натуральные лица и фактуры",
    locations: "природная локация, культурный центр, открытая площадка, живые детали костюма",
    referenceNotes: "Локальная культура показывается уважительно и современно, без карикатуры и случайных символов.",
    constraints: "без случайных вывесок; без мультяшности; сохранить один центральный образ героя",
  },
  {
    id: "concert",
    label: "Концертный",
    energy: "мощная performance-энергия, кульминация на припеве",
    visualStyle: "дорогой концертный кинореализм, световые акценты, крупные планы артиста",
    locations: "репетиционная студия, backstage, сцена, открытая площадка",
    referenceNotes: "Артист узнаваем в каждом кадре, камера работает как live performance.",
    constraints: "без хаотичного света; без лишних дублей артиста; без логотипов",
  },
  {
    id: "dance",
    label: "Dance video",
    energy: "танцевальная, синхронная, высокий монтажный темп",
    visualStyle: "современная хореография, tracking shots, handheld, живой городской свет",
    locations: "танцевальная студия, коридор, городская площадь, крыша",
    referenceNotes: "Движение строится вокруг лидера, группа усиливает припевы.",
    constraints: "группа не перекрывает главного героя; движения не выглядят случайными",
  },
  {
    id: "lyric",
    label: "Lyric video",
    energy: "эмоциональная, текстовая, с ясными визуальными символами",
    visualStyle: "киношный lyric video без перегруза, предметные крупные планы, мягкий свет",
    locations: "интерьер, окно, улица после дождя, финальный широкий кадр",
    referenceNotes: "Текст можно использовать только если пользователь явно просит вывести строки на экран.",
    constraints: "без случайного текста; если нужен текст, он должен точно совпадать с песней",
  },
  {
    id: "fashion",
    label: "Fashion/live",
    energy: "стильная, уверенная, визуально дорогая",
    visualStyle: "fashion live action, clean composition, выразительный свет, кинематографичные позы",
    locations: "лофт, студия, минималистичный коридор, ночная улица",
    referenceNotes: "Акцент на силуэте, костюме, лице и плавной смене позиций.",
    constraints: "без пластиковой кожи; без смены лица; без лишних аксессуаров",
  },
];

const FILM_DIRECTOR_TEMPLATES: DirectorTemplate[] = [
  {
    id: "dialogue",
    label: "Диалог",
    energy: "камерная, напряжение растёт через паузы, взгляды и подтекст",
    visualStyle: "реалистичная драматическая сцена, close-ups, controlled handheld, натуральная актёрская игра",
    locations: "квартира вечером, лифт, коридор, маленький офис, машина на парковке",
    referenceNotes: "Главное — лица, паузы, микрожесты, дистанция между героями и смена власти в диалоге.",
    constraints: "без случайных прохожих; без смены лиц; без театральной игры; без текста на экране",
  },
  {
    id: "thriller",
    label: "Триллер",
    energy: "нарастающая тревога, короткие действия, скрытая угроза",
    visualStyle: "киношный thriller realism, низкий ключ, практический свет, напряжённая камера",
    locations: "ночной коридор, парковка, лестница, пустой офис, подъезд",
    referenceNotes: "Держать неизвестность через звук, тени, отражения и неполную информацию.",
    constraints: "без монстров; без крови крупным планом; без случайных надписей; не раскрывать угрозу слишком рано",
  },
  {
    id: "action",
    label: "Экшен",
    energy: "динамичная, физическая, монтаж ускоряется к кульминации",
    visualStyle: "реалистичная action scene, practical stunts, tracking camera, readable geography",
    locations: "склад, крыша, улица, подземная парковка, промышленный коридор",
    referenceNotes: "Экшен должен быть понятным: где герой, где препятствие, куда он движется.",
    constraints: "без хаотичной камеры; без мультяшных трюков; без лишних дублей героя; без логотипов",
  },
  {
    id: "drama",
    label: "Драма",
    energy: "эмоциональная, сдержанная, сильная внутренняя кульминация",
    visualStyle: "поэтичный кинореализм, мягкий свет, длинные паузы, выразительные крупные планы",
    locations: "кухня ночью, больничный коридор, пустая комната, вокзал, дождливая улица",
    referenceNotes: "Сцена держится на выборе героя, не на красивых случайных кадрах.",
    constraints: "без мелодраматической наигранности; без лишних персонажей; без смены времени суток без причины",
  },
  {
    id: "art-scene",
    label: "Арт-сцена",
    energy: "созерцательная, символическая, напряжение через композицию и детали",
    visualStyle: "артхаусный realism, статичные кадры, предметные детали, минималистичный свет",
    locations: "галерея, пустой зал, мастерская, гостиничный номер, заброшенный павильон",
    referenceNotes: "Реальные предметы становятся символами: зеркало, ткань, вода, дверь, свет.",
    constraints: "без абстрактного фэнтези; без случайных символов; без текста на экране; сохранить причинность сцены",
  },
];

const CLIP_CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "soprano-heroine",
    label: "Сопрано-героиня",
    hint: "один мощный образ",
    profile: "девушка lead soprano, мощный чистый голос, один центральный образ, героиня ведёт клип через взгляд, жест и вокальную силу",
    referenceNotes: "Цельный образ героини: натуральное лицо, дорогой свет, выразительные крупные планы, один узнаваемый костюм на весь клип.",
    constraints: "без дублирования главной героини; без смены лица и костюма; без случайного текста на экране; без мультяшности",
  },
  {
    id: "male-vocal",
    label: "Мужской вокал",
    hint: "драматичный фронтмен",
    profile: "мужчина lead vocal, сильный эмоциональный голос, один узнаваемый фронтмен, уверенная пластика без театральности",
    referenceNotes: "Акцент на лице, руках, микрофоне, движении к камере и контрасте между backstage и открытым пространством.",
    constraints: "без смены лица артиста; без лишних дублей; без логотипов; не превращать клип в случайный концертный монтаж",
  },
  {
    id: "rap-artist",
    label: "Рэп артист",
    hint: "ритм и улица",
    profile: "рэп-исполнитель, харизматичный центральный герой, чёткая артикуляция, уверенный street performance, камера держит лицо и руки",
    referenceNotes: "Урбан-среда, ритмичные проходки, реальные люди на фоне, пластика рук и корпуса на сильных долях.",
    constraints: "без агрессивной карикатуры; без случайных надписей; без лишней массовки; не менять одежду между сценами без причины",
  },
  {
    id: "dance-leader",
    label: "Лидер + танцоры",
    hint: "группа вокруг",
    profile: "одна lead-певица или артист в центре, вокруг 4-8 танцоров, группа отвечает на импульсы лидера и не перекрывает лицо",
    referenceNotes: "Хореография строится слоями: сначала лидер, затем группа, затем широкий синхронный финал.",
    constraints: "танцоры не перекрывают главного героя; без хаотичных движений; без дублирования артиста; сохранять формацию читаемой",
  },
  {
    id: "band-front",
    label: "Фронт + группа",
    hint: "живой band look",
    profile: "солист или солистка на переднем плане, живая группа на втором плане, музыканты поддерживают драматургию, но центр остаётся у вокала",
    referenceNotes: "Микрофон, инструменты, репетиционная студия, сцена или rooftop; кадры выглядят как дорогой live performance.",
    constraints: "без случайных логотипов на инструментах; без смены солиста; группа не забирает центральный фокус",
  },
];

const FILM_CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: "two-hander",
    label: "Два героя",
    hint: "диалог и конфликт",
    profile: "два главных героя сцены: герой A и герой B, реалистичная актёрская игра, конфликт раскрывается через дистанцию, паузы и взгляды",
    referenceNotes: "Сцена держится на смене власти в диалоге: кто ближе к камере, кто молчит, кто первым делает физическое действие.",
    constraints: "без смены лиц; без лишних персонажей; без театральной игры; сохранять пространственную географию между героями",
  },
  {
    id: "single-protagonist",
    label: "Один герой",
    hint: "внутренний выбор",
    profile: "один главный герой сцены, сильная внутренняя эмоция, выразительный взгляд, микрожесты рук и лица, реалистичная актёрская игра",
    referenceNotes: "Камера показывает решение героя через крупные планы, предметы в руках и изменение света в пространстве.",
    constraints: "без появления случайных персонажей; без смены лица; без прямого текста на экране; не объяснять эмоцию титрами",
  },
  {
    id: "antagonist",
    label: "Антагонист",
    hint: "давление в кадре",
    profile: "главный герой и антагонист, напряжение строится через контроль пространства, взгляд, паузы и угрозу без прямого насилия",
    referenceNotes: "Антагонист часто занимает край кадра или тень, герой постепенно возвращает контроль через движение и позицию.",
    constraints: "без крови крупным планом; без карикатурного злодея; без хаотичной камеры; сохранять лица и костюмы",
  },
  {
    id: "ensemble",
    label: "Ансамбль",
    hint: "3-5 ролей",
    profile: "ансамбль 3-5 актёров, у каждого понятная роль в сцене, главный герой выделен позицией, светом и действием",
    referenceNotes: "Группа работает как драматическая система: кто-то скрывает информацию, кто-то давит, кто-то помогает выбору героя.",
    constraints: "не добавлять лишних людей; не путать роли; главный герой должен оставаться читаемым; без случайных костюмов",
  },
  {
    id: "family-scene",
    label: "Семейная сцена",
    hint: "эмоция без пафоса",
    profile: "семейная сцена с 2-4 персонажами, реалистичные отношения, конфликт через бытовую деталь, тишину и недосказанность",
    referenceNotes: "Домашняя или камерная локация, предметы быта, живые паузы, мягкий драматический свет.",
    constraints: "без мелодраматической наигранности; без лишних персонажей; без случайных надписей; не менять возраст и лица актёров",
  },
];

const CINEMATOGRAPHY_PRESETS: CinematographyPreset[] = [
  {
    id: "wide-epic",
    label: "Epic wide",
    hint: "простор и масштаб",
    camera: "wide establishing shots, slow dolly, low angle hero framing",
    lens: "24mm wide lens for landscapes, 50mm hero close-ups",
    lighting: "golden hour, strong rim light, natural contrast",
    visualStyle: "эпический кинореализм, широкие планы, медленная уверенная камера, дорогой природный свет",
    referenceNotes: "Камера сначала показывает масштаб пространства, затем возвращается к лицу героя; финал должен работать как постер.",
    constraints: "без пустых красивых кадров без героя; не терять лицо центрального персонажа; избегать чрезмерного фэнтези-света",
  },
  {
    id: "handheld-drama",
    label: "Handheld drama",
    hint: "лица и напряжение",
    camera: "controlled handheld, close-ups, over-the-shoulder shots, rack focus",
    lens: "35mm and 50mm natural perspective, shallow depth of field",
    lighting: "low-key practical light, soft face highlights, realistic shadows",
    visualStyle: "реалистичная драматическая камера, controlled handheld, крупные планы и живые паузы",
    referenceNotes: "Каждый кадр держит психологию: взгляд, дистанция, микрожесты, кто занимает центр и кто отступает.",
    constraints: "без тряски ради тряски; без театральной игры; сохранять географию сцены и лица актёров",
  },
  {
    id: "stage-reveal",
    label: "Stage reveal",
    hint: "концертный свет",
    camera: "backstage tracking shot, stage reveal, crane-like move, tight vocal close-up",
    lens: "70mm long lens through light beams, 35mm stage movement",
    lighting: "controlled concert beams, practical stage lights, no chaotic haze",
    visualStyle: "дорогой performance clip, backstage-to-stage reveal, концертный свет без хаоса",
    referenceNotes: "Сцена раскрывается через подготовку: кабель, микрофон, свет, первый шаг артиста и широкий performance-кадр.",
    constraints: "без случайных логотипов; без пересветов и хаотичных лучей; артист должен быть узнаваем в каждом кадре",
  },
  {
    id: "dance-tracking",
    label: "Dance tracking",
    hint: "ритм и движение",
    camera: "low tracking shot, diagonal glide, front choreography frame, controlled orbit",
    lens: "28mm for formation, 50mm for leader close-up",
    lighting: "clean studio light, floor reflections, sharp rhythmic highlights",
    visualStyle: "современная хореография, tracking shots, читаемые формации, энергичная камера",
    referenceNotes: "Камера поддерживает ритм: сначала ноги и руки, затем лидер, затем формация целиком.",
    constraints: "не перекрывать лицо лидера; движения не должны быть случайными; сохранять расстояния и направление группы",
  },
  {
    id: "fashion-closeup",
    label: "Fashion close",
    hint: "костюм и лицо",
    camera: "clean close-ups, profile turn, slow push-in, precise pose transitions",
    lens: "85mm portrait lens, 50mm medium fashion frame",
    lighting: "softbox key light, glossy highlights, clean background separation",
    visualStyle: "fashion live action, чистая композиция, выразительный портретный свет, костюм как часть драматургии",
    referenceNotes: "Образ держится на силуэте, лице, руках, ткани, аксессуаре и плавной смене позиций.",
    constraints: "без пластиковой кожи; без лишних аксессуаров; без смены лица; не превращать кадр в рекламу одежды",
  },
  {
    id: "noir-tension",
    label: "Noir tension",
    hint: "тени и угроза",
    camera: "static tension frame, slow creeping dolly, reflection shot, tight close-up",
    lens: "40mm intimate frame, 75mm compressed corridor shot",
    lighting: "hard practical light, deep shadows, narrow warm highlights",
    visualStyle: "кинематографичный noir realism, глубокие тени, отражения, коридоры и напряжение",
    referenceNotes: "Скрывать часть информации через тени, отражения и неполный обзор; напряжение растёт без прямого объяснения.",
    constraints: "без крови крупным планом; без случайных надписей; не раскрывать угрозу слишком рано; без мультяшной тьмы",
  },
];

const SOURCE_SYMBOL_STOPWORDS = new Set([
  "intro",
  "verse",
  "chorus",
  "bridge",
  "куплет",
  "припев",
  "интро",
  "бридж",
  "вместе",
  "только",
  "снова",
  "через",
  "потом",
  "друзья",
  "сердце",
  "душа",
  "души",
  "герой",
  "героя",
  "героиня",
  "голос",
]);

const INITIAL_FORM = CLIP_DEFAULT_FORM;

const PREVIEW_GRADIENTS = [
  "from-[#1d1c4c] via-[#414a8c] to-[#fdc36a]",
  "from-[#172033] via-[#3b5d8a] to-[#95e7ff]",
  "from-[#221635] via-[#844fb9] to-[#ff9e6e]",
  "from-[#123331] via-[#2c8b84] to-[#ffe6a3]",
  "from-[#2d2442] via-[#8c6cb8] to-[#f5d7ff]",
];

function mmss(sec: number): string {
  const safe = Math.max(0, Math.round(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function rangeLabel(start: number, end: number): string {
  return `${mmss(start)}-${mmss(end)}`;
}

async function postJson<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  return requestJson<T>(url, "POST", body, headers);
}

async function requestJson<T>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await apiFetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : {};
  if (!res.ok) {
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return data as T;
}

function normalizeScenesForTimeline(scenes: VideoDirectorScene[], durationSec: number): VideoDirectorScene[] {
  return scenes.map((scene, index) => {
    const startSec = index * 10;
    return {
      ...scene,
      id: index + 1,
      startSec,
      endSec: Math.min(Math.max(durationSec, startSec + 1), startSec + 10),
    };
  });
}

function moveScene(scenes: VideoDirectorScene[], fromId: number, toId: number, durationSec: number): VideoDirectorScene[] {
  const fromIndex = scenes.findIndex((scene) => scene.id === fromId);
  const toIndex = scenes.findIndex((scene) => scene.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return scenes;
  const next = [...scenes];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return normalizeScenesForTimeline(next, durationSec);
}

function energyFromBpm(bpm?: number): string {
  if (!bpm) return "";
  if (bpm >= 126) return "быстрая, танцевальная, высокий монтажный темп";
  if (bpm <= 82) return "медленная, драматичная, крупные планы и плавная камера";
  return "средний темп, уверенное нарастание к припеву";
}

function formatAudioAnalysis(analysis?: VideoDirectorAudioAnalysis | null): string {
  if (!analysis) return "";
  return [
    analysis.bpm ? `${Math.round(analysis.bpm)} BPM` : "",
    analysis.key ? `${analysis.key}${analysis.mode ? ` ${analysis.mode}` : ""}` : "",
    typeof analysis.lufs === "number" ? `${analysis.lufs.toFixed(1)} LUFS` : "",
    analysis.duration ? mmss(analysis.duration) : "",
  ].filter(Boolean).join(" · ");
}

function extractSourceSymbols(sourceText: string): string[] {
  const counts = new Map<string, number>();
  for (const match of sourceText.toLowerCase().matchAll(/[\p{L}\p{N}-]{4,}/gu)) {
    const word = match[0].replace(/^\d+|\d+$/g, "").trim();
    if (!word || SOURCE_SYMBOL_STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6)
    .map(([word]) => word);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="min-w-0 max-w-full [overflow-wrap:anywhere] text-[13px] font-bold text-[#23233f]">{children}</span>;
}

function appendUniqueText(current: string, addition: string, maxLength = 960): string {
  const cleanCurrent = current.trim();
  const cleanAddition = addition.trim();
  if (!cleanAddition) return cleanCurrent;
  if (cleanCurrent.toLowerCase().includes(cleanAddition.toLowerCase())) return cleanCurrent;
  const next = [cleanCurrent, cleanAddition].filter(Boolean).join("\n");
  return next.length > maxLength ? `${next.slice(0, maxLength - 1).trimEnd()}…` : next;
}

function appendInlineText(current: string, addition: string, maxLength = 180): string {
  const cleanCurrent = current.trim();
  const cleanAddition = addition.trim();
  if (!cleanAddition) return cleanCurrent;
  if (cleanCurrent.toLowerCase().includes(cleanAddition.toLowerCase())) return cleanCurrent;
  const next = [cleanCurrent, cleanAddition].filter(Boolean).join("; ");
  return next.length > maxLength ? `${next.slice(0, maxLength - 1).trimEnd()}…` : next;
}

function productionBibleRules(mode: VideoDirectorMode, sourceSymbols: string[]): ProductionBibleRulePreset[] {
  const symbols = sourceSymbols.length ? sourceSymbols.join(", ") : "ключевые слова и повторяющиеся образы из текста";
  const subject = mode === "clip" ? "артиста/героя клипа" : "актёров сцены";
  return [
    {
      id: "hero-lock",
      label: "Hero lock",
      hint: "лицо, роль, узнаваемость",
      referenceNotes: `Character bank: зафиксировать ${subject}: same face, same age range, same body type, узнаваемый силуэт и единая эмоциональная дуга.`,
      constraints: "не менять лицо главного героя; не добавлять дублей центрального персонажа; не менять возраст, этничность и типаж между сценами",
    },
    {
      id: "costume-lock",
      label: "Костюм lock",
      hint: "одежда и силуэт",
      referenceNotes: "Wardrobe bible: один основной костюм или одна костюмная семья; фиксировать цвет, силуэт, фактуру ткани и узнаваемую деталь образа.",
      constraints: "без случайной смены одежды; без лишних аксессуаров; костюм меняется только если это явно часть драматургии",
    },
    {
      id: "lyric-symbols",
      label: "Символы текста",
      hint: symbols,
      referenceNotes: `Visual motifs from source: ${symbols}. Каждая сцена должна визуализировать конкретную строку, повтор, предмет или эмоциональный beat из материала.`,
      constraints: "не добавлять символы, города, бренды и культурные детали, которых нет в тексте, локациях или референсах пользователя",
    },
    {
      id: "beat-map",
      label: "Beat map",
      hint: "интро, куплет, припев, финал",
      referenceNotes: mode === "clip"
        ? "Beat/energy map: интро вводит героя и мотив; куплет раскрывает путь; припев расширяет движение и performance; финал собирает главный стоп-кадр."
        : "Beat/energy map: завязка задаёт пространство; середина усиливает конфликт; поворот меняет власть; финал закрывается выбором или паузой.",
      energy: mode === "clip" ? "по секциям: интро тише, куплет в движении, припев peak, финал самый широкий" : "по драме: завязка тише, конфликт нарастает, поворот peak, финал сдержанный",
    },
    {
      id: "location-logic",
      label: "Локации без мусора",
      hint: "только из текста",
      referenceNotes: "Location bible: использовать только локации из текста, пользовательских полей и референсов; переходы между местами должны быть причинными.",
      constraints: "не придумывать реальные города, регионы, площади, школы, клубы, бренды и вывески, если пользователь явно не указал их",
    },
    {
      id: "negative-rules",
      label: "Negative pack",
      hint: "защита генерации",
      constraints: "negative prompt для всех сцен: no subtitles, no random text, no watermark, no logo artifacts, no distorted face, no duplicated lead character, no plastic skin, no unreadable signs",
    },
  ];
}

function buildPreGenerationReadiness(
  form: FormState,
  sourceSymbols: string[],
  referenceSlotFiles: Record<string, string>,
  selectedCinematographyPresetId: string,
): PreGenerationReadinessItem[] {
  const referenceText = `${form.referenceNotes}\n${form.constraints}`.toLowerCase();
  const hasCostume = /костюм|одежд|силуэт|wardrobe|costume|ткан/i.test(referenceText);
  const hasCamera = Boolean(selectedCinematographyPresetId)
    || /камера|camera|линз|lens|оператор|handheld|tracking|close|wide/i.test(referenceText + form.visualStyle);
  const refCount = Object.keys(referenceSlotFiles).length;
  return [
    {
      id: "hero",
      label: form.mode === "clip" ? "Герой/вокал" : "Актёры",
      value: form.vocalProfile.trim().length > 20 ? "задан character bank" : "опишите лицо, роль и дугу",
      ready: form.vocalProfile.trim().length > 20,
    },
    {
      id: "costume",
      label: "Костюм",
      value: hasCostume ? "есть wardrobe rule" : "нужен силуэт и цвет",
      ready: hasCostume,
    },
    {
      id: "locations",
      label: "Локации",
      value: form.locations.trim().length > 18 ? "есть location bible" : "задайте мир сцены",
      ready: form.locations.trim().length > 18,
    },
    {
      id: "camera",
      label: "Камера/свет",
      value: hasCamera ? "операторский пресет выбран" : "выберите пресет",
      ready: hasCamera,
    },
    {
      id: "beats",
      label: "Beat/energy",
      value: form.audioAnalysis ? "есть аудио-анализ" : "можно загрузить аудио",
      ready: Boolean(form.audioAnalysis) || form.energy.trim().length > 18,
    },
    {
      id: "symbols",
      label: "Символы текста",
      value: sourceSymbols.length ? sourceSymbols.slice(0, 3).join(", ") : "вставьте текст",
      ready: sourceSymbols.length > 0,
    },
    {
      id: "refs",
      label: "Референсы",
      value: refCount ? `${refCount} файл(а)` : "опционально: можно перетащить фото",
      ready: refCount > 0 || form.referenceNotes.trim().length > 40,
    },
    {
      id: "negative",
      label: "Запреты",
      value: form.constraints.trim().length > 28 ? "continuity защищён" : "добавьте negative rules",
      ready: form.constraints.trim().length > 28,
    },
  ];
}

function energyColor(energy: "low" | "mid" | "high" | "peak"): string {
  if (energy === "peak") return "from-[#7048ff] to-[#ff8a35]";
  if (energy === "high") return "from-[#7a55ff] to-[#00b7e8]";
  if (energy === "mid") return "from-[#a892ff] to-[#7edcff]";
  return "from-[#dcd5ff] to-[#dff8ff]";
}

function FeatureChip({
  icon: Icon,
  label,
}: {
  icon: typeof Lightbulb;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-[#ddd7fb] bg-white/85 px-4 py-2 text-xs font-bold text-[#363452] shadow-sm">
      <Icon className="h-4 w-4 text-[#7147ff]" />
      {label}
    </div>
  );
}

function ReferenceSlotsInput({
  files,
  activeSlot,
  onSlotDrag,
  onSlotFile,
}: {
  files: Record<string, string>;
  activeSlot: string | null;
  onSlotDrag: (slotId: string | null) => void;
  onSlotFile: (slotId: VideoDirectorReferenceSlotId, fileName: string) => void;
}) {
  const inputRefs = useRef<Partial<Record<VideoDirectorReferenceSlotId, HTMLInputElement | null>>>({});

  const acceptFile = (slotId: VideoDirectorReferenceSlotId, file?: File) => {
    if (!file) return;
    onSlotFile(slotId, file.name);
  };

  return (
    <div className="grid gap-1.5">
      <FieldLabel>Референсы production bible</FieldLabel>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {VIDEO_DIRECTOR_REFERENCE_SLOTS.map((slot) => (
          <div
            key={slot.id}
            role="button"
            tabIndex={0}
            onClick={() => inputRefs.current[slot.id]?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRefs.current[slot.id]?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              onSlotDrag(slot.id);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              onSlotDrag(slot.id);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              onSlotDrag(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              acceptFile(slot.id, event.dataTransfer.files?.[0]);
              onSlotDrag(null);
            }}
            className={cn(
              "min-w-0 cursor-pointer rounded-2xl border border-dashed bg-white px-3 py-3 transition hover:border-[#7048ff] hover:bg-[#fbfaff]",
              activeSlot === slot.id ? "border-[#7048ff] bg-[#f7f3ff] shadow-[0_0_0_4px_rgba(112,72,255,0.10)]" : "border-[#d9dcf0]",
            )}
          >
            <span className="flex items-start gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eefaff] text-[#0aaee8]">
                <UploadCloud className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-extrabold text-[#202039]">{slot.label}</span>
                <span className="mt-1 block truncate text-[11px] text-[#747796]">{files[slot.id] || slot.hint}</span>
              </span>
            </span>
            <input
              ref={(node) => {
                inputRefs.current[slot.id] = node;
              }}
              type="file"
              aria-label={`Загрузить изображение: ${slot.label}`}
              accept="image/*"
              className="sr-only"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                acceptFile(slot.id, event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductionBiblePrepPanel({
  readiness,
  rules,
  onApplyRule,
}: {
  readiness: PreGenerationReadinessItem[];
  rules: ProductionBibleRulePreset[];
  onApplyRule: (rule: ProductionBibleRulePreset) => void;
}) {
  const readyCount = readiness.filter((item) => item.ready).length;
  return (
    <div className="rounded-2xl border border-[#dfe1f1] bg-[#fbfbff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#7048ff]">Production bible до генерации</p>
          <p className="mt-1 text-xs leading-relaxed text-[#666982]">
            Чем больше правил задано до кнопки, тем меньше модель придумывает лишнее.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#202039] shadow-sm">
          {readyCount}/{readiness.length} настроено
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {readiness.map((item) => (
          <div
            key={item.id}
            className={cn(
              "min-w-0 rounded-xl border px-3 py-2",
              item.ready ? "border-[#ccebdc] bg-[#f5fffa]" : "border-[#ece6ff] bg-white",
            )}
          >
            <div className="flex items-center gap-2">
              {item.ready ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22a66a]" />
              ) : (
                <Lock className="h-4 w-4 shrink-0 text-[#9b8ee0]" />
              )}
              <span className="truncate text-xs font-extrabold text-[#202039]">{item.label}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-[#747796]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <FieldLabel>Быстрые правила режиссёра</FieldLabel>
        <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2">
          {rules.map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => onApplyRule(rule)}
              className="min-h-[96px] w-[168px] shrink-0 rounded-2xl border border-[#e1ddfb] bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#7048ff] hover:shadow-sm"
            >
              <span className="flex items-center gap-2 text-sm font-extrabold text-[#202039]">
                <Sparkles className="h-4 w-4 shrink-0 text-[#7048ff]" />
                <span className="min-w-0 truncate">{rule.label}</span>
              </span>
              <span className="mt-2 line-clamp-2 text-[11px] leading-snug text-[#666982]">
                {rule.hint}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScenePreviewTile({
  scene,
  index,
  locked,
}: {
  scene: Pick<VideoDirectorScene, "startSec" | "endSec" | "label" | "visual">;
  index: number;
  locked?: boolean;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[#dddff2] bg-white shadow-sm">
      <div className="p-3">
        <p className="text-xs font-extrabold text-[#6a39ff]">{rangeLabel(scene.startSec, scene.endSec)}</p>
        <h4 className="mt-1 line-clamp-2 min-h-[38px] text-sm font-bold leading-tight text-[#23233f]">
          {locked ? "Скрытая сцена" : scene.label}
        </h4>
      </div>
      <div className={cn("relative h-20 bg-gradient-to-br", PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length])}>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 h-1 rounded-full bg-white/55" />
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-sm">
            <Lock className="h-5 w-5 text-[#6a39ff]" />
          </div>
        )}
      </div>
    </article>
  );
}

function StoryboardPreview({
  project,
  durationSec,
}: {
  project: PublicVideoDirectorProject | null;
  durationSec: number;
}) {
  const step = Math.min(10, Math.max(5, Math.round(durationSec / 18)));
  const previewScenes = project?.scenes?.length
    ? project.scenes.slice(0, 4)
    : [
        { startSec: 0, endSec: step, label: "Первый образ героя", visual: "" },
        { startSec: step, endSec: step * 2, label: "Движение камеры и вход в историю", visual: "" },
        { startSec: step * 2, endSec: step * 3, label: "Нарастание энергии", visual: "" },
        { startSec: step * 3, endSec: step * 4, label: "Кульминационный кадр", visual: "" },
      ];

  return (
    <div className="mt-7">
      <h3 className="text-xl font-extrabold text-[#202039]">Автоматическая раскадровка</h3>
      <div className="relative mt-5 h-6">
        <div className="absolute left-2 right-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#6a39ff] via-[#7c5cff] to-[#6a39ff]" />
        {[0, 1, 2, 3].map((dot) => (
          <div
            key={dot}
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-4 border-[#f7f8ff] bg-[#7048ff] shadow-sm"
            style={{ left: `${dot * 33.33}%` }}
          />
        ))}
      </div>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {previewScenes.map((scene, index) => (
          <ScenePreviewTile
            key={`${scene.startSec}-${index}`}
            scene={scene}
            index={index}
            locked={Boolean(project && index >= project.scenes.length)}
          />
        ))}
      </div>
    </div>
  );
}

function DirectorAnalysisCard({
  analysis,
  ideas,
  selectedIdeaId,
  project,
  durationSec,
  mode,
  loadingStoryboard,
  onSelectIdea,
  onCopyPrompt,
}: {
  analysis: VideoDirectorAnalysis | null;
  ideas: VideoDirectorIdea[];
  selectedIdeaId: string;
  project: PublicVideoDirectorProject | null;
  durationSec: number;
  mode: VideoDirectorMode;
  loadingStoryboard: boolean;
  onSelectIdea: (ideaId: string) => void;
  onCopyPrompt: () => void;
}) {
  const primaryPrompt = loadingStoryboard
    ? "Собираю первые сцены, таймкоды, hero continuity и prompt-ready карточку для выбранного направления..."
    : project?.scenes?.[0]?.prompt || "После выбора идеи здесь появится готовый промпт для первого видеофрагмента.";

  return (
    <div className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_55px_rgba(37,35,89,0.10)] backdrop-blur sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold text-[#6b3dff]">Режиссёрский анализ</p>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight text-[#202039] sm:text-3xl">
            Идеи и выбранное направление
          </h2>
        </div>
        <div className="rounded-2xl bg-[#e9faff] px-4 py-2 text-lg font-extrabold text-[#078bb5]">
          {mmss(durationSec)}
        </div>
      </div>

      {analysis && (
        <div className="mt-4 grid gap-2 text-sm text-[#666982] sm:grid-cols-2">
          <p><span className="font-bold text-[#23233f]">Энергия:</span> {analysis.energy}</p>
          <p><span className="font-bold text-[#23233f]">Язык:</span> {analysis.language}</p>
          <p className="sm:col-span-2"><span className="font-bold text-[#23233f]">Образы:</span> {analysis.keyImages.join(", ")}</p>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-extrabold text-[#202039]">
            {ideas.length ? `Выберите направление из ${ideas.length} идей` : "Пакет концепций"}
          </p>
          {ideas.length > 0 && (
            <span className="rounded-full bg-[#f2edff] px-3 py-1 text-xs font-extrabold text-[#7048ff]">
              {ideas.length} концепций
            </span>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
        {ideas.length > 0 ? ideas.map((idea, index) => {
          const selected = selectedIdeaId === idea.id;
          return (
            <button
              type="button"
              key={idea.id}
              onClick={() => onSelectIdea(idea.id)}
              className={cn(
                "group grid min-h-[118px] grid-cols-[46px_1fr_auto] items-start gap-3 rounded-2xl border bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                selected ? "border-[#7a55ff] ring-2 ring-[#7a55ff]/15" : "border-[#e2e4f0]",
                index === 0 && ideas.length % 2 === 1 && "xl:col-span-2",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0eaff] text-sm font-extrabold text-[#6a39ff]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-base font-extrabold leading-tight text-[#202039]">{idea.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#666982]">{idea.logline}</p>
              </div>
              {loadingStoryboard && selected ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#6a39ff]" />
              ) : selected ? (
                <CheckCircle2 className="h-7 w-7 text-[#7048ff]" />
              ) : (
                <Clapperboard className="h-5 w-5 text-[#9a9ab8] transition group-hover:text-[#7048ff]" />
              )}
            </button>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-[#d9dcf0] bg-[#f9faff] p-7 text-center text-sm text-[#747796]">
            {mode === "clip"
              ? "Заполните форму и получите пять направлений для клипа."
              : "Заполните форму и получите пять режиссёрских решений для сцены фильма."}
          </div>
        )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <FeatureChip icon={Lightbulb} label={mode === "clip" ? "5 идей клипа" : "5 идей сцены"} />
        <FeatureChip icon={Clock3} label="таймкоды" />
        <FeatureChip icon={MessageSquareText} label="промпты" />
        <FeatureChip icon={Sparkles} label="negative prompt" />
        <FeatureChip icon={FileText} label="production pack" />
      </div>

      <div className="mt-5 rounded-2xl bg-[#161631] p-5 text-white shadow-[0_18px_45px_rgba(22,22,49,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-extrabold">
              <Sparkles className="h-4 w-4 text-[#9f7cff]" />
              {mode === "clip" ? "Готовый промпт для видео" : "Готовый промпт для сцены"}
            </p>
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-white/82">{primaryPrompt}</p>
          </div>
          <button
            type="button"
            onClick={onCopyPrompt}
            disabled={!project?.scenes?.length}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#0aaee8] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#079bd0] disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            Скопировать
          </button>
        </div>
      </div>

      <StoryboardPreview project={project} durationSec={durationSec} />
    </div>
  );
}

function StoryboardStudio({
  project,
  activeSceneId,
  saving,
  saveStatus,
  onActiveSceneChange,
  onSceneChange,
  onSceneReorder,
  onSave,
}: {
  project: PublicVideoDirectorProject;
  activeSceneId: number | null;
  saving: boolean;
  saveStatus: string;
  onActiveSceneChange: (sceneId: number) => void;
  onSceneChange: (sceneId: number, patch: Partial<VideoDirectorScene>) => void;
  onSceneReorder: (fromId: number, toId: number) => void;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [selectedModelVariant, setSelectedModelVariant] = useState<VideoDirectorModelVariantId>("master");
  const scenes = project.scenes;
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) || scenes[0];
  const activeIndex = scenes.findIndex((scene) => scene.id === activeScene?.id);
  const nextScene = activeIndex >= 0 ? scenes[activeIndex + 1] : undefined;
  const bible = useMemo(() => buildProductionBible(project), [project]);
  const shotPlan = useMemo(() => activeScene ? buildSceneShotPlan(activeScene) : [], [activeScene]);
  const canEdit = project.unlocked;

  if (!activeScene) return null;

  const shownPrompt = buildModelPromptVariant(activeScene, project, selectedModelVariant);
  const canEditPrompt = canEdit && selectedModelVariant === "master";

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(`${shownPrompt}\n\nNegative prompt: ${activeScene.negativePrompt}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const applyQuickAction = (actionId: VideoDirectorQuickActionId) => {
    if (!canEdit) return;
    setSelectedModelVariant("master");
    onSceneChange(activeScene.id, { prompt: applyScenePromptQuickAction(activeScene.prompt, actionId) });
  };

  const lockedPlaceholders = Array.from({ length: project.lockedCount }, (_, index) => ({
    id: `locked-${index}`,
    startSec: (scenes.length + index) * 10,
    endSec: Math.min(project.input.durationSec, (scenes.length + index + 1) * 10),
  }));

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-[#dfe1f1] bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#f2edff] px-3 py-1 text-xs font-extrabold text-[#7048ff]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Production timeline
          </p>
          <h3 className="mt-2 text-xl font-extrabold text-[#202039]">
            AI Production Bible
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#666982]">
            {canEdit
              ? "Character bank, asset bible, beat timeline, model variants и storyboard можно довести перед PDF."
              : "Первые сцены открыты для просмотра. Production bible, editable prompts и reorder откроются после разблокировки."}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={copyPrompt}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dfe1f1] bg-white px-4 py-2.5 text-sm font-extrabold text-[#202039] shadow-sm transition hover:-translate-y-0.5"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            Скопировать
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canEdit || saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#171735] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить pack
          </button>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)]">
        <article className="min-w-0 rounded-2xl border border-[#e4e6f2] bg-[#fbfbff] p-4">
          <p className="text-xs font-extrabold uppercase text-[#7048ff]">Continuity score</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {bible.readiness.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "min-w-0 rounded-xl border px-3 py-2",
                  item.status === "ready" ? "border-emerald-200 bg-emerald-50" : "border-[#eadcff] bg-white",
                )}
              >
                <p className="flex items-center gap-2 text-xs font-extrabold text-[#202039]">
                  <span className={cn("h-2.5 w-2.5 rounded-full", item.status === "ready" ? "bg-emerald-500" : "bg-[#ffb454]")} />
                  {item.label}
                </p>
                <p className="mt-1 truncate text-[11px] text-[#666982]">{item.value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-[#e4e6f2] bg-white p-4">
          <p className="text-xs font-extrabold uppercase text-[#008eb7]">Beat / energy timeline</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
            {bible.beats.map((beat) => (
              <div key={beat.id} className="min-w-0 overflow-hidden rounded-xl border border-[#e4e6f2] bg-[#fbfbff]">
                <div className={cn("h-2 bg-gradient-to-r", energyColor(beat.energy))} />
                <div className="p-3">
                  <p className="truncate text-xs font-extrabold text-[#7048ff]">{rangeLabel(beat.startSec, beat.endSec)}</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-[#202039]">{beat.label}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#666982]">{beat.goal}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          { title: "Герои", items: bible.characters },
          { title: "Локации", items: bible.locations },
          { title: "Костюмы", items: bible.costumes },
          { title: "Реквизит", items: bible.props },
          { title: "Запреты", items: bible.forbidden },
        ].map((group) => (
          <article key={group.title} className="min-w-0 rounded-2xl border border-[#e4e6f2] bg-white p-3">
            <p className="text-xs font-extrabold text-[#202039]">{group.title}</p>
            <div className="mt-2 grid gap-2">
              {group.items.slice(0, 3).map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-[#f8f8ff] px-3 py-2">
                  <p className="truncate text-[11px] font-extrabold text-[#7048ff]">{item.label}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#666982]">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2">
        <div className="flex min-w-max gap-3">
          {scenes.map((scene, index) => {
            const active = scene.id === activeScene.id;
            return (
              <button
                key={`${scene.id}-${scene.startSec}`}
                type="button"
                draggable={canEdit}
                onClick={() => onActiveSceneChange(scene.id)}
                onDragStart={() => canEdit && setDraggedId(scene.id)}
                onDragOver={(event) => {
                  if (canEdit) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (canEdit && draggedId) onSceneReorder(draggedId, scene.id);
                  setDraggedId(null);
                }}
                onDragEnd={() => setDraggedId(null)}
                className={cn(
                  "group w-[178px] shrink-0 overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  active ? "border-[#7048ff] ring-2 ring-[#7048ff]/15" : "border-[#dfe1f1]",
                  draggedId === scene.id && "opacity-50",
                )}
              >
                <div className="flex items-start gap-2 p-3">
                  <span className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold",
                    active ? "bg-[#7048ff] text-white" : "bg-[#f2edff] text-[#7048ff]",
                  )}>
                    {String(scene.id).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-extrabold text-[#7048ff]">
                      {rangeLabel(scene.startSec, scene.endSec)}
                    </span>
                    <span className="mt-1 block line-clamp-2 min-h-[38px] text-sm font-extrabold leading-tight text-[#202039]">
                      {scene.label}
                    </span>
                  </span>
                  {canEdit && <GripVertical className="mt-1 h-4 w-4 shrink-0 text-[#b0aecb] group-hover:text-[#7048ff]" />}
                </div>
                <div className={cn("h-16 bg-gradient-to-br", PREVIEW_GRADIENTS[index % PREVIEW_GRADIENTS.length])}>
                  <div className="h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.42),transparent_32%),linear-gradient(to_top,rgba(0,0,0,0.30),transparent)]" />
                </div>
              </button>
            );
          })}

          {lockedPlaceholders.map((item, index) => (
            <div
              key={item.id}
              className="flex w-[178px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-dashed border-[#d8d9ef] bg-[#fbfbff] text-left shadow-sm"
            >
              <div className="p-3">
                <p className="text-xs font-extrabold text-[#9a9ab8]">{rangeLabel(item.startSec, item.endSec)}</p>
                <p className="mt-1 min-h-[38px] text-sm font-extrabold leading-tight text-[#747796]">Сцена в production pack</p>
              </div>
              <div className={cn("flex h-16 items-center justify-center bg-gradient-to-br", PREVIEW_GRADIENTS[(scenes.length + index) % PREVIEW_GRADIENTS.length])}>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-[#7048ff] backdrop-blur">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)]">
        <article className="min-w-0 rounded-2xl border border-[#e4e6f2] bg-[#fbfbff] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase text-[#7048ff]">
                {String(activeScene.id).padStart(2, "0")} · {rangeLabel(activeScene.startSec, activeScene.endSec)}
              </p>
              <h4 className="mt-1 text-lg font-extrabold text-[#202039]">{activeScene.label}</h4>
            </div>
            {canEdit && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eafaf2] px-3 py-1 text-xs font-extrabold text-emerald-700">
                <Pencil className="h-3.5 w-3.5" />
                editable
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-3 text-sm leading-relaxed text-[#555873]">
            <p><span className="font-bold text-[#202039]">Задача:</span> {activeScene.purpose}</p>
            <p><span className="font-bold text-[#202039]">Кадр:</span> {activeScene.visual}</p>
            <p><span className="font-bold text-[#202039]">Действие:</span> {activeScene.action}</p>
            <p><span className="font-bold text-[#202039]">Камера:</span> {activeScene.camera}</p>
            <p><span className="font-bold text-[#202039]">Свет:</span> {activeScene.lighting}</p>
            <p><span className="font-bold text-[#202039]">Переход:</span> {buildSceneTransitionNote(activeScene, nextScene)}</p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {shotPlan.map((shot) => (
              <div key={shot.id} className="rounded-xl border border-[#e4e6f2] bg-white px-3 py-3">
                <p className="text-[11px] font-extrabold uppercase text-[#7048ff]">{shot.label}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-snug text-[#202039]">{shot.action}</p>
                <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-[#747796]">{shot.camera}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="min-w-0 rounded-2xl border border-[#e4e6f2] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase text-[#008eb7]">Prompt-ready card</p>
            {saveStatus && <p className="text-xs font-bold text-[#747796]">{saveStatus}</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {VIDEO_DIRECTOR_MODEL_VARIANTS.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedModelVariant(variant.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-extrabold transition",
                  selectedModelVariant === variant.id
                    ? "border-[#7048ff] bg-[#f2edff] text-[#7048ff]"
                    : "border-[#dfe1f1] bg-white text-[#666982] hover:border-[#7048ff]",
                )}
                title={variant.hint}
              >
                {variant.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {VIDEO_DIRECTOR_QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={!canEdit}
                onClick={() => applyQuickAction(action.id)}
                className="rounded-xl border border-[#e1ddfb] bg-[#fbfaff] px-3 py-2 text-xs font-extrabold text-[#514a90] transition hover:border-[#7048ff] disabled:cursor-not-allowed disabled:opacity-50"
                title={action.hint}
              >
                {action.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-extrabold text-[#23233f]">Prompt</span>
            <textarea
              value={shownPrompt}
              readOnly={!canEditPrompt}
              onChange={(event) => onSceneChange(activeScene.id, { prompt: event.target.value })}
              rows={9}
              className={cn(
                "w-full resize-y rounded-xl border border-[#dfe1f1] bg-[#fbfbff] px-3 py-3 font-mono text-xs leading-relaxed text-[#2f2f45] outline-none ring-[#7048ff]/20 transition focus:ring-4",
                !canEditPrompt && "cursor-not-allowed opacity-75",
              )}
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-extrabold text-[#23233f]">Negative prompt</span>
            <textarea
              value={activeScene.negativePrompt}
              readOnly={!canEdit}
              onChange={(event) => onSceneChange(activeScene.id, { negativePrompt: event.target.value })}
              rows={3}
              className={cn(
                "w-full resize-y rounded-xl border border-[#f0dada] bg-[#fffafa] px-3 py-3 font-mono text-xs leading-relaxed text-[#7b5860] outline-none ring-[#7048ff]/20 transition focus:ring-4",
                !canEdit && "cursor-not-allowed opacity-75",
              )}
            />
          </label>
        </article>
      </div>
    </div>
  );
}

function HiddenScenesGate({
  lockedCount,
  hasEnoughTokens,
  loading,
  onUnlock,
}: {
  lockedCount: number;
  hasEnoughTokens: boolean;
  loading: boolean;
  onUnlock: () => void;
}) {
  const restricted = useVkPurchaseRestriction();
  if (lockedCount <= 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#eadcff] bg-white shadow-sm">
      <div className="relative flex min-h-[210px] flex-col items-center justify-center px-5 py-8 text-center">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.08),rgba(0,212,255,0.08),rgba(255,180,80,0.10))]" />
        <div className="relative z-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#7048ff] shadow-sm">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-extrabold text-[#202039]">Ещё {lockedCount} сцен в production pack</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#666982]">
            Откроем полный storyboard, editable prompts, reorder сцен, negative prompts и PDF-доставку.
          </p>
          <button
            type="button"
            onClick={onUnlock}
            disabled={loading || (restricted && !hasEnoughTokens)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7048ff] via-[#00b7e8] to-[#ff8a35] px-6 py-3 font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
            {hasEnoughTokens ? `Открыть production pack за ${TOKEN_COST} токенов` : restricted ? "Недостаточно токенов" : `Открыть production pack за ${PRICE_RUB} ₽`}
          </button>
          {restricted && !hasEnoughTokens && <p className="mx-auto mt-3 max-w-xl text-sm text-[#666982]">{VK_DIGITAL_PURCHASE_NOTICE}</p>}
        </div>
      </div>
    </div>
  );
}

function DirectorGlobalNav({
  view,
  onProjects,
  onNewProject,
}: {
  view: "projects" | "create";
  onProjects: () => void;
  onNewProject: () => void;
}) {
  return (
    <header className="border-b border-white/[0.08] bg-[#0c0d0f]/95 px-4 backdrop-blur-xl sm:px-7">
      <div className="mx-auto flex min-h-[68px] max-w-[1720px] items-center gap-5">
        <button type="button" onClick={onProjects} className="flex shrink-0 items-center gap-2.5 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#22d3ee] text-white shadow-[0_0_28px_rgba(124,58,237,.35)]">
            <Clapperboard className="h-4 w-4" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-black tracking-tight text-white">AI режиссёр</span>
            <span className="block text-[10px] font-medium text-white/40">Cinema Studio</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 text-sm font-semibold text-white/55 lg:flex" aria-label="Основная навигация">
          <button type="button" onClick={onProjects} className={cn("rounded-lg px-3 py-2 transition hover:bg-white/[0.06] hover:text-white", view === "projects" && "bg-white/[0.07] text-white")}>Projects</button>
          <button type="button" onClick={onNewProject} className={cn("rounded-lg px-3 py-2 transition hover:bg-white/[0.06] hover:text-white", view === "create" && "text-white")}>Generate</button>
          <button type="button" className="rounded-lg px-3 py-2 transition hover:bg-white/[0.06] hover:text-white">Assets</button>
          <button type="button" className="rounded-lg px-3 py-2 transition hover:bg-white/[0.06] hover:text-white">Community</button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onNewProject} className="hidden items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold text-[#111214] transition hover:bg-white/85 sm:inline-flex">
            <Plus className="h-3.5 w-3.5" /> Новый проект
          </button>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.12] text-white/70 transition hover:border-white/25 hover:text-white" aria-label="Профиль">
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function DirectorProjectCard({
  item,
  onClick,
  badge,
}: {
  item: DirectorLibraryItem;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#17181b] text-left transition duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-[#1b1c20] hover:shadow-[0_16px_45px_rgba(0,0,0,.28)]"
    >
      <div className="relative aspect-[1.62/1] overflow-hidden" style={{ background: item.gradient }}>
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(3,5,8,.8),transparent_60%)]" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[10px] font-bold text-white/80 backdrop-blur-md">
          <Sparkles className="h-3 w-3" /> AI режиссёр
        </div>
        <span className="absolute bottom-3 left-3 right-3 line-clamp-2 text-base font-extrabold leading-tight text-white drop-shadow-lg">{item.subtitle}</span>
        <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <ArrowDownToLine className="h-3.5 w-3.5 rotate-[-45deg]" />
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-extrabold text-white/90">{item.title}</p>
          {badge ? <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-1 text-[10px] font-bold text-white/50">{badge}</span> : <MoreHorizontal className="h-4 w-4 shrink-0 text-white/30" />}
        </div>
        <p className="mt-1 text-xs font-medium text-white/40">{item.scenes} сцен · {item.kind}</p>
      </div>
    </button>
  );
}

function DirectorProjectLibrary({
  savedProjects,
  savedProjectsLoading,
  onOpenSaved,
  onOpenExample,
  onNewProject,
}: {
  savedProjects: SavedDirectorProject[];
  savedProjectsLoading: boolean;
  onOpenSaved: (projectId: string) => void;
  onOpenExample: (item: DirectorLibraryItem) => void;
  onNewProject: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "clip" | "film">("all");
  const [gridView, setGridView] = useState(true);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const savedItems: DirectorLibraryItem[] = savedProjects.map((item, index) => ({
    id: item.projectId,
    title: item.title,
    subtitle: item.selectedIdeaTitle || "Новый режиссёрский проект",
    scenes: `${item.scenesReady}/${item.totalScenes || item.scenesReady}`,
    kind: item.mode === "film" ? "фильм" : "клип",
    gradient: DIRECTOR_LIBRARY_EXAMPLES[index % DIRECTOR_LIBRARY_EXAMPLES.length].gradient,
  }));
  const allItems = [...savedItems, ...DIRECTOR_LIBRARY_EXAMPLES];
  const filteredItems = allItems.filter((item) => {
    const matchesTab = activeTab === "all" || item.kind === (activeTab === "clip" ? "клип" : "фильм");
    const matchesQuery = !normalizedQuery || `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(normalizedQuery);
    return matchesTab && matchesQuery;
  });

  return (
    <section className="min-h-[calc(100vh-69px)] bg-[#0c0d0f] px-4 pb-16 pt-9 text-white sm:px-7 lg:pt-12">
      <div className="mx-auto max-w-[1720px]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-white/35">Workspace / Projects</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-white sm:text-5xl">Мои AI режиссёрские проекты</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45 sm:text-base">Соберите идею, раскадровку по таймкодам и prompt-ready сцены в одной production-папке.</p>
          </div>
          <button type="button" onClick={onNewProject} className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#101113] transition hover:bg-white/85">
            <Plus className="h-4 w-4" /> Создать проект
          </button>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-b border-white/[0.09] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1">
            {[
              { id: "all" as const, label: "Все проекты" },
              { id: "clip" as const, label: "Клипы" },
              { id: "film" as const, label: "Фильмы" },
            ].map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn("rounded-lg px-3 py-2 text-sm font-bold transition", activeTab === tab.id ? "bg-white text-[#111214]" : "text-white/45 hover:bg-white/[0.06] hover:text-white")}>{tab.label}</button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.11] bg-white/[0.04] px-3 py-2 text-sm text-white/45 focus-within:border-white/30 sm:w-64">
              <Search className="h-4 w-4 shrink-0" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск проектов" className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/30" />
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.11] bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/60 transition hover:border-white/25 hover:text-white"><SlidersHorizontal className="h-4 w-4" /> Сортировка <ChevronDown className="h-3.5 w-3.5" /></button>
            <div className="flex rounded-xl border border-white/[0.11] bg-white/[0.04] p-1">
              <button type="button" onClick={() => setGridView(true)} className={cn("rounded-lg p-1.5", gridView ? "bg-white text-[#111214]" : "text-white/40 hover:text-white")} aria-label="Сетка"><Grid2X2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setGridView(false)} className={cn("rounded-lg p-1.5", !gridView ? "bg-white text-[#111214]" : "text-white/40 hover:text-white")} aria-label="Список"><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <div className={cn("mt-7 grid gap-4", gridView ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-2") }>
          {savedProjectsLoading && Array.from({ length: 4 }, (_, index) => <div key={`loading-${index}`} className="aspect-[1.62/1] animate-pulse rounded-[18px] bg-white/[0.06]" />)}
          {filteredItems.map((item, index) => (
            <DirectorProjectCard
              key={`${item.id}-${index}`}
              item={item}
              badge={index >= savedItems.length ? "пример" : undefined}
              onClick={() => index < savedItems.length ? onOpenSaved(item.id) : onOpenExample(item)}
            />
          ))}
          {!savedProjectsLoading && filteredItems.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-white/[0.14] px-6 py-16 text-center text-sm text-white/40">Проекты не найдены. Попробуйте другой запрос или создайте новый.</div>}
        </div>
      </div>
    </section>
  );
}

export function AiVideoDirectorClient({ embedded = false, initialAudioTaskId, initialAudioFileName }: AiVideoDirectorClientProps) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [sessionId, setSessionId] = useState("");
  const [analysis, setAnalysis] = useState<VideoDirectorAnalysis | null>(null);
  const [ideas, setIdeas] = useState<VideoDirectorIdea[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [project, setProject] = useState<PublicVideoDirectorProject | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingStoryboard, setLoadingStoryboard] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState(initialAudioFileName || "файл не выбран");
  const [audioDragActive, setAudioDragActive] = useState(false);
  const [selectedCharacterPresetId, setSelectedCharacterPresetId] = useState(CLIP_CHARACTER_PRESETS[0]?.id || "");
  const [selectedCinematographyPresetId, setSelectedCinematographyPresetId] = useState("");
  const [audioAnalyzing, setAudioAnalyzing] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedDirectorProject[]>([]);
  const [savedProjectsLoading, setSavedProjectsLoading] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"projects" | "create">("projects");
  const [activeSceneId, setActiveSceneId] = useState<number | null>(null);
  const [savingScenes, setSavingScenes] = useState(false);
  const [sceneSaveStatus, setSceneSaveStatus] = useState("");
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const [voiceoverText, setVoiceoverText] = useState("");
  const [voiceoverVoice, setVoiceoverVoice] = useState<typeof TTS_VOICES[number]>("serena");
  const [voiceoverStyle, setVoiceoverStyle] = useState("спокойный кинодиктор, выразительные паузы");
  const [referenceSlotFiles, setReferenceSlotFiles] = useState<Record<string, string>>({});
  const [activeReferenceSlot, setActiveReferenceSlot] = useState<string | null>(null);
  const initialAudioTaskRef = useRef("");
  const initialDirectorDraftRef = useRef("");
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const paidTokens = (user?.song_credits ?? 0) + (user?.referral_bonus ?? 0);
  const hasEnoughTokens = isAuthenticated && paidTokens >= TOKEN_COST;
  const audioSummary = formatAudioAnalysis(form.audioAnalysis);
  const directorTemplates = form.mode === "clip" ? CLIP_DIRECTOR_TEMPLATES : FILM_DIRECTOR_TEMPLATES;
  const characterPresets = form.mode === "clip" ? CLIP_CHARACTER_PRESETS : FILM_CHARACTER_PRESETS;
  const sourceSymbols = useMemo(() => extractSourceSymbols(form.sourceText), [form.sourceText]);
  const bibleRulePresets = useMemo(() => productionBibleRules(form.mode, sourceSymbols), [form.mode, sourceSymbols]);
  const preGenerationReadiness = useMemo(
    () => buildPreGenerationReadiness(form, sourceSymbols, referenceSlotFiles, selectedCinematographyPresetId),
    [form, sourceSymbols, referenceSlotFiles, selectedCinematographyPresetId],
  );

  const inputStats = useMemo(() => {
    const chars = form.sourceText.trim().length;
    const scenes = Math.max(1, Math.ceil(form.durationSec / 10));
    return { chars, scenes };
  }, [form.sourceText, form.durationSec]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetGeneratedState = () => {
    setAnalysis(null);
    setIdeas([]);
    setSelectedIdeaId("");
    setSessionId("");
    setProject(null);
    setWidgetToken(null);
    setPaymentId(null);
    setError(null);
    setActiveSceneId(null);
    setSceneSaveStatus("");
  };

  useEffect(() => {
    const shouldReadDraft = new URLSearchParams(window.location.search).get("directorDraft") === "home";
    if (!shouldReadDraft || initialDirectorDraftRef.current) return;
    let rawDraft = "";
    try {
      rawDraft = window.sessionStorage.getItem(AI_VIDEO_DIRECTOR_DRAFT_STORAGE_KEY) || "";
      window.sessionStorage.removeItem(AI_VIDEO_DIRECTOR_DRAFT_STORAGE_KEY);
    } catch {}
    if (!rawDraft) return;

    let sourceText = rawDraft.trim();
    let mode: VideoDirectorMode = "clip";
    try {
      const parsed = JSON.parse(rawDraft) as { sourceText?: string; mode?: string };
      sourceText = parsed.sourceText?.trim() || sourceText;
      mode = parsed.mode === "film" ? "film" : "clip";
    } catch {}
    if (!sourceText) return;

    initialDirectorDraftRef.current = sourceText;
    const defaults = mode === "film" ? FILM_DEFAULT_FORM : CLIP_DEFAULT_FORM;
    setForm({
      ...defaults,
      sourceText,
      title: mode === "film" ? "Сцена по описанию" : "Клип по тексту",
    });
    setAudioFileName("файл не выбран");
    setReferenceSlotFiles({});
    setSelectedCharacterPresetId(mode === "film" ? FILM_CHARACTER_PRESETS[0]?.id || "" : CLIP_CHARACTER_PRESETS[0]?.id || "");
    setSelectedCinematographyPresetId("");
    setAnalysis(null);
    setIdeas([]);
    setSelectedIdeaId("");
    setSessionId("");
    setProject(null);
    setWidgetToken(null);
    setPaymentId(null);
    setError(null);
    setActiveSceneId(null);
    setSceneSaveStatus("");
    setWorkspaceMode("create");
    window.setTimeout(() => {
      document.getElementById("director-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setSavedProjectsLoading(true);
    apiFetch("/api/tools/ai-video-director/projects", { headers: getAuthHeaders() })
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => {
        if (!cancelled) setSavedProjects(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setSavedProjects([]);
      })
      .finally(() => {
        if (!cancelled) setSavedProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!project?.scenes?.length) {
      setActiveSceneId(null);
      return;
    }
    if (!activeSceneId || !project.scenes.some((scene) => scene.id === activeSceneId)) {
      setActiveSceneId(project.scenes[0].id);
    }
  }, [activeSceneId, project]);

  useEffect(() => {
    if (!renderJob?.jobId || renderJob.status === "completed" || renderJob.status === "failed") return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await apiFetch(`/api/tools/ai-video-director/render?jobId=${encodeURIComponent(renderJob.jobId)}`);
        const data = await response.json() as RenderJob;
        if (!cancelled && response.ok) {
          setRenderJob(data);
          if (data.status !== "completed" && data.status !== "failed") timer = window.setTimeout(() => void poll(), 5000);
        }
      } catch {
        if (!cancelled) timer = window.setTimeout(() => void poll(), 8000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [renderJob?.jobId, renderJob?.status]);

  const useSample = () => {
    const defaults = form.mode === "film" ? FILM_DEFAULT_FORM : CLIP_DEFAULT_FORM;
    setForm({
      ...defaults,
      sourceText: form.mode === "film" ? FILM_SAMPLE_SOURCE : CLIP_SAMPLE_SOURCE,
    });
    setAudioFileName("файл не выбран");
    setReferenceSlotFiles({});
    setSelectedCinematographyPresetId("");
    resetGeneratedState();
    setWorkspaceMode("create");
  };

  const startNewProject = () => {
    setForm(INITIAL_FORM);
    setAudioFileName("файл не выбран");
    setReferenceSlotFiles({});
    setSelectedCharacterPresetId(CLIP_CHARACTER_PRESETS[0]?.id || "");
    setSelectedCinematographyPresetId("");
    resetGeneratedState();
    setWorkspaceMode("create");
    window.setTimeout(() => document.getElementById("director-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  const openExampleProject = (item: DirectorLibraryItem) => {
    setForm({
      ...CLIP_DEFAULT_FORM,
      title: `${item.title} — ${item.subtitle}`,
      sourceText: CLIP_SAMPLE_SOURCE,
    });
    setAudioFileName("файл не выбран");
    setReferenceSlotFiles({});
    setSelectedCharacterPresetId(CLIP_CHARACTER_PRESETS[0]?.id || "");
    setSelectedCinematographyPresetId("");
    resetGeneratedState();
    setWorkspaceMode("create");
    window.setTimeout(() => document.getElementById("director-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  const changeMode = (mode: VideoDirectorMode) => {
    if (form.mode === mode) return;
    const previousDefaults = form.mode === "film" ? FILM_DEFAULT_FORM : CLIP_DEFAULT_FORM;
    const nextDefaults = mode === "film" ? FILM_DEFAULT_FORM : CLIP_DEFAULT_FORM;
    const previousSample = form.mode === "film" ? FILM_SAMPLE_SOURCE : CLIP_SAMPLE_SOURCE;
    const nextSample = mode === "film" ? FILM_SAMPLE_SOURCE : CLIP_SAMPLE_SOURCE;

    setForm((prev) => ({
      ...prev,
      mode,
      title: prev.title === previousDefaults.title ? nextDefaults.title : prev.title,
      sourceText: prev.sourceText === previousSample ? nextSample : prev.sourceText,
      vocalProfile: prev.vocalProfile === previousDefaults.vocalProfile ? nextDefaults.vocalProfile : prev.vocalProfile,
      energy: prev.energy === previousDefaults.energy ? nextDefaults.energy : prev.energy,
      visualStyle: prev.visualStyle === previousDefaults.visualStyle ? nextDefaults.visualStyle : prev.visualStyle,
      locations: prev.locations === previousDefaults.locations ? nextDefaults.locations : prev.locations,
      referenceNotes: prev.referenceNotes === previousDefaults.referenceNotes ? nextDefaults.referenceNotes : prev.referenceNotes,
      constraints: prev.constraints === previousDefaults.constraints ? nextDefaults.constraints : prev.constraints,
      audioAnalysis: undefined,
    }));
    setAudioFileName("файл не выбран");
    setReferenceSlotFiles({});
    setSelectedCharacterPresetId(mode === "film" ? FILM_CHARACTER_PRESETS[0]?.id || "" : CLIP_CHARACTER_PRESETS[0]?.id || "");
    setSelectedCinematographyPresetId("");
    resetGeneratedState();
  };

  const applyTemplate = (template: DirectorTemplate) => {
    setForm((prev) => ({
      ...prev,
      energy: template.energy,
      visualStyle: template.visualStyle,
      locations: template.locations,
      referenceNotes: template.referenceNotes,
      constraints: template.constraints,
    }));
    resetGeneratedState();
  };

  const applyCharacterPreset = (preset: CharacterPreset) => {
    setSelectedCharacterPresetId(preset.id);
    setForm((prev) => ({
      ...prev,
      vocalProfile: preset.profile,
      referenceNotes: preset.referenceNotes,
      constraints: preset.constraints,
    }));
    resetGeneratedState();
  };

  const applyCinematographyPreset = (preset: CinematographyPreset) => {
    setSelectedCinematographyPresetId(preset.id);
    setForm((prev) => ({
      ...prev,
      visualStyle: preset.visualStyle,
      referenceNotes: appendUniqueText(
        prev.referenceNotes,
        `Операторский пресет: ${preset.label}. Камера: ${preset.camera}. Линза: ${preset.lens}. Свет: ${preset.lighting}. ${preset.referenceNotes}`,
      ),
      constraints: appendUniqueText(prev.constraints, preset.constraints),
    }));
    resetGeneratedState();
  };

  const applyProductionBibleRule = (rule: ProductionBibleRulePreset) => {
    setForm((prev) => ({
      ...prev,
      energy: rule.energy ? appendInlineText(prev.energy, rule.energy) : prev.energy,
      referenceNotes: rule.referenceNotes ? appendUniqueText(prev.referenceNotes, rule.referenceNotes) : prev.referenceNotes,
      constraints: rule.constraints ? appendUniqueText(prev.constraints, rule.constraints) : prev.constraints,
    }));
    resetGeneratedState();
  };

  const attachReferenceSlot = (slotId: VideoDirectorReferenceSlotId, fileName: string) => {
    const slot = VIDEO_DIRECTOR_REFERENCE_SLOTS.find((item) => item.id === slotId);
    setReferenceSlotFiles((prev) => ({ ...prev, [slotId]: fileName }));
    setForm((prev) => ({
      ...prev,
      referenceNotes: appendUniqueText(prev.referenceNotes, `Референс ${slot?.label || slotId}: ${fileName}`),
    }));
    resetGeneratedState();
  };

  const applyAnalyzeResult = useCallback((result: AnalyzeResult) => {
    const nextAudio: VideoDirectorAudioAnalysis = {
      duration: typeof result.duration === "number" ? result.duration : undefined,
      bpm: typeof result.bpm === "number" ? result.bpm : undefined,
      key: typeof result.key === "string" ? result.key : undefined,
      mode: typeof result.mode === "string" ? result.mode : undefined,
      lufs: typeof result.lufs_integrated === "number" ? result.lufs_integrated : undefined,
    };
    setForm((prev) => ({
      ...prev,
      durationSec: nextAudio.duration ? normalizeVideoDirectorDuration(nextAudio.duration, prev.durationSec) : prev.durationSec,
      title: initialAudioFileName && prev.title === CLIP_DEFAULT_FORM.title ? initialAudioFileName.replace(/\.[^.]+$/, "") : prev.title,
      energy: energyFromBpm(nextAudio.bpm) || prev.energy,
      audioAnalysis: nextAudio,
    }));
  }, [initialAudioFileName]);

  const pollAudioAnalysisTask = useCallback(async (taskId: string) => {
    for (let i = 0; i < 40; i++) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const poll = await apiFetch(`/api/analyze/result/${taskId}`);
      if (!poll.ok) continue;
      const data = await poll.json();
      if (data.status === "completed" && data.result) {
        applyAnalyzeResult(data.result as AnalyzeResult);
        return;
      }
      if (data.status === "failed") return;
    }
  }, [applyAnalyzeResult]);

  useEffect(() => {
    if (!initialAudioTaskId || initialAudioTaskRef.current === initialAudioTaskId) return;
    initialAudioTaskRef.current = initialAudioTaskId;
    if (initialAudioFileName) setAudioFileName(initialAudioFileName);
    setAudioAnalyzing(true);
    pollAudioAnalysisTask(initialAudioTaskId).finally(() => setAudioAnalyzing(false));
  }, [initialAudioFileName, initialAudioTaskId, pollAudioAnalysisTask]);

  const analyzeAudioFile = useCallback(async (file: File) => {
    setAudioAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const submit = await apiFetch("/api/analyze/submit", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!submit.ok) return;
      const submitted = await submit.json();
      if (!submitted.task_id) return;
      await pollAudioAnalysisTask(submitted.task_id);
    } catch {
    } finally {
      setAudioAnalyzing(false);
    }
  }, [pollAudioAnalysisTask]);

  const acceptAudioFile = useCallback((file: File) => {
    if (!file) return;
    if (file.size > ANALYZE_MAX_FILE_BYTES) {
      setError(largeAudioFileMessage(file.size / 1024 / 1024));
      return;
    }
    setAudioFileName(file.name);
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const nextDuration = normalizeVideoDirectorDuration(audio.duration);
        setForm((prev) => ({
          ...prev,
          durationSec: nextDuration,
          title: prev.title ? prev.title : file.name.replace(/\.[^.]+$/, ""),
        }));
      }
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => URL.revokeObjectURL(url);
    void analyzeAudioFile(file);
  }, [analyzeAudioFile]);

  const handleAudioFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) acceptAudioFile(file);
  };

  const handleAudioDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAudioDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) acceptAudioFile(file);
  };

  const handleAudioDrag = (event: DragEvent<HTMLDivElement>, active: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setAudioDragActive(active);
  };

  const generateIdeas = async () => {
    setLoadingIdeas(true);
    setError(null);
    setProject(null);
    setWidgetToken(null);
    try {
      const data = await postJson<IdeasResponse>("/api/tools/ai-video-director/ideas", form);
      setSessionId(data.sessionId);
      setAnalysis(data.analysis);
      setIdeas(data.ideas);
      setSelectedIdeaId(data.ideas[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать идеи");
    } finally {
      setLoadingIdeas(false);
    }
  };

  const buildStoryboard = async (ideaId = selectedIdeaId) => {
    if (!sessionId || !ideaId) return;
    setSelectedIdeaId(ideaId);
    setWorkspaceMode("create");
    setProject(null);
    setWidgetToken(null);
    setPaymentId(null);
    setLoadingStoryboard(true);
    setError(null);
    try {
      const data = await postJson<PublicVideoDirectorProject>("/api/tools/ai-video-director/storyboard", {
        sessionId,
        selectedIdeaId: ideaId,
      });
      setProject(data);
      setSelectedIdeaId(data.selectedIdea.id);
      if (isAuthenticated) {
        apiFetch("/api/tools/ai-video-director/projects", { headers: getAuthHeaders() })
          .then((res) => res.ok ? res.json() : { items: [] })
          .then((fresh) => setSavedProjects(Array.isArray(fresh.items) ? fresh.items : []))
          .catch(() => {});
      }
      window.setTimeout(() => {
        document.getElementById("storyboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать раскадровку");
    } finally {
      setLoadingStoryboard(false);
    }
  };

  const loadSavedProject = async (projectId: string) => {
    setError(null);
    setSavedProjectsLoading(true);
    try {
      const res = await apiFetch(`/api/tools/ai-video-director/projects?projectId=${encodeURIComponent(projectId)}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось открыть проект");
      const saved = data as PublicVideoDirectorProject & { paymentId?: string };
      setForm(saved.input);
      setWorkspaceMode("create");
      setAnalysis(saved.analysis);
      setIdeas(saved.ideas);
      setSelectedIdeaId(saved.selectedIdea.id);
      setProject(saved);
      if (saved.paymentId) setPaymentId(saved.paymentId);
      window.setTimeout(() => {
        document.getElementById("storyboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть проект");
    } finally {
      setSavedProjectsLoading(false);
    }
  };

  const loadFullProject = async (payId?: string | null) => {
    if (!project?.projectId) return false;
    const data = await postJson<PublicVideoDirectorProject & { paymentId?: string }>(
      "/api/tools/ai-video-director/full",
      { projectId: project.projectId, paymentId: payId || paymentId || undefined },
    );
    setProject(data);
    if (data.paymentId) setPaymentId(data.paymentId);
    return true;
  };

  const updateScene = (sceneId: number, patch: Partial<VideoDirectorScene>) => {
    setSceneSaveStatus("Есть несохранённые правки");
    setProject((prev) => prev
      ? {
          ...prev,
          scenes: prev.scenes.map((scene) => scene.id === sceneId ? { ...scene, ...patch } : scene),
        }
      : prev);
  };

  const reorderScenes = (fromId: number, toId: number) => {
    if (!project?.unlocked) return;
    const movedScene = project.scenes.find((scene) => scene.id === fromId);
    const nextScenes = moveScene(project.scenes, fromId, toId, project.input.durationSec);
    setProject((prev) => prev ? { ...prev, scenes: nextScenes } : prev);
    const nextActive = movedScene
      ? nextScenes.find((scene) => scene.prompt === movedScene.prompt && scene.label === movedScene.label)
      : null;
    setActiveSceneId(nextActive?.id || toId);
    setSceneSaveStatus("Порядок изменён, сохраните pack");
  };

  const saveStoryboardScenes = async (scenesOverride?: VideoDirectorScene[]) => {
    if (!project?.projectId || !project.unlocked) return false;
    setSavingScenes(true);
    setSceneSaveStatus("Сохраняем...");
    setError(null);
    try {
      const data = await requestJson<PublicVideoDirectorProject & { paymentId?: string }>(
        "/api/tools/ai-video-director/projects",
        "PATCH",
        {
          projectId: project.projectId,
          paymentId: paymentId || undefined,
          scenes: scenesOverride || project.scenes,
        },
        getAuthHeaders(),
      );
      setProject(data);
      if (data.paymentId) setPaymentId(data.paymentId);
      setSceneSaveStatus("Production pack сохранён");
      return true;
    } catch (e) {
      setSceneSaveStatus("");
      setError(e instanceof Error ? e.message : "Не удалось сохранить production pack");
      return false;
    } finally {
      setSavingScenes(false);
    }
  };

  const unlockWithMoney = async () => {
    if (!project?.projectId) return;
    const data = await postJson<{ paymentId?: string; confirmationToken?: string; url?: string; already_paid?: boolean }>(
      "/api/billing/landing-checkout",
      { type: "video_director", clipId: project.projectId },
    );
    if (data.paymentId) setPaymentId(data.paymentId);
    if (data.already_paid) {
      await loadFullProject(data.paymentId || null);
      return;
    }
    if (data.confirmationToken) {
      setWidgetToken(data.confirmationToken);
      return;
    }
    if (data.url) {
      throw new Error("Платёж открылся как внешняя ссылка. Попробуйте ещё раз.");
    }
    throw new Error("Платёж не создан");
  };

  const unlock = async () => {
    if (!project?.projectId) return;
    setUnlocking(true);
    setError(null);
    try {
      if (hasEnoughTokens) {
        const data = await postJson<{ ok?: boolean; paymentId?: string; needs_auth?: boolean; needs_payment?: boolean }>(
          "/api/tools/ai-video-director/unlock",
          { projectId: project.projectId },
          getAuthHeaders(),
        );
        if (data.ok) {
          if (data.paymentId) setPaymentId(data.paymentId);
          await refreshUser();
          await loadFullProject(data.paymentId || null);
          return;
        }
        if (data.needs_auth) {
          openAuthModal();
          return;
        }
      }
      await unlockWithMoney();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось разблокировать");
    } finally {
      setUnlocking(false);
    }
  };

  const onPaymentSuccess = async () => {
    setWidgetToken(null);
    setUnlocking(true);
    let ok = false;
    for (let i = 0; i < 6 && !ok; i++) {
      try {
        ok = await loadFullProject(paymentId);
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
    }
    setUnlocking(false);
    if (!ok) setError("Оплата прошла, но подтверждение ещё не дошло. Нажмите открыть ещё раз через пару секунд.");
  };

  const downloadPdf = async () => {
    if (!project?.projectId) return;
    if (!project.unlocked) {
      await unlock();
      return;
    }
    setPdfLoading(true);
    setError(null);
    try {
      if (sceneSaveStatus && !sceneSaveStatus.includes("сохранён")) {
        const saved = await saveStoryboardScenes();
        if (!saved) return;
      }
      const res = await apiFetch("/api/tools/ai-video-director/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.projectId, paymentId: paymentId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "PDF не готов");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai_video_director_${project.projectId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скачать PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const renderFullVideo = async () => {
    if (!project?.projectId) return;
    if (!project.unlocked) {
      await unlock();
      return;
    }
    setRenderLoading(true);
    setError(null);
    try {
      if (sceneSaveStatus && !sceneSaveStatus.includes("сохранён")) {
        const saved = await saveStoryboardScenes();
        if (!saved) return;
      }
      const data = await postJson<RenderJob>("/api/tools/ai-video-director/render", {
        projectId: project.projectId,
        paymentId: paymentId || undefined,
        voiceover: voiceoverText.trim() ? { text: voiceoverText.trim(), voice: voiceoverVoice, instructions: voiceoverStyle.trim() } : undefined,
      });
      setRenderJob(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось поставить видео в рендер");
    } finally {
      setRenderLoading(false);
    }
  };

  const copyPrimaryPrompt = async () => {
    const scene = project?.scenes?.[0];
    if (!scene) return;
    await navigator.clipboard.writeText(`${scene.prompt}\n\nNegative prompt: ${scene.negativePrompt}`);
  };

  return (
    <main className={cn("pg-product-theme min-w-0 max-w-full flex-1 overflow-x-hidden bg-[#0c0d0f] text-[#202039]", embedded && "bg-transparent")}>
      <DirectorGlobalNav
        view={workspaceMode}
        onProjects={() => setWorkspaceMode("projects")}
        onNewProject={startNewProject}
      />
      {workspaceMode === "projects" ? (
        <DirectorProjectLibrary
          savedProjects={savedProjects}
          savedProjectsLoading={savedProjectsLoading}
          onOpenSaved={(projectId) => void loadSavedProject(projectId)}
          onOpenExample={openExampleProject}
          onNewProject={startNewProject}
        />
      ) : (
        <div className="min-h-[calc(100vh-69px)] bg-[#0c0d0f] px-3 pb-16 pt-4 sm:px-5 lg:px-7 lg:pt-6">
          <div className="mx-auto flex max-w-[1720px] items-start gap-4 xl:gap-6">
            <aside className="sticky top-4 hidden w-[224px] shrink-0 flex-col rounded-2xl border border-white/[0.09] bg-[#141517] p-4 text-white lg:flex" aria-label="Этапы проекта">
              <button type="button" onClick={() => setWorkspaceMode("projects")} className="mb-7 inline-flex items-center gap-2 px-2 text-xs font-bold text-white/45 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Все проекты</button>
              <div className="border-b border-white/[0.08] pb-5">
                <p className="truncate text-sm font-extrabold text-white">{form.title || "Новый проект"}</p>
                <p className="mt-1 text-xs text-white/35">{form.mode === "clip" ? "Клип" : "Фильм"} · AI режиссёр</p>
              </div>
              <div className="mt-5 grid gap-1">
                {[
                  { label: "Brief", caption: "Идея и исходный текст", icon: FileText, active: !analysis && !project },
                  { label: "Ideas", caption: "5 режиссёрских направлений", icon: Lightbulb, active: Boolean(analysis) && !project },
                  { label: "Storyboard", caption: "Таймкоды и prompt cards", icon: Clapperboard, active: Boolean(project) },
                  { label: "Render", caption: "H3 · финальный клип", icon: Film, active: Boolean(renderJob) },
                ].map((step, index) => (
                  <div key={step.label} className={cn("flex items-start gap-3 rounded-xl px-2.5 py-3", step.active ? "bg-white/[0.08] text-white" : "text-white/35")}>
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black", step.active ? "bg-white text-[#111214]" : "bg-white/[0.07] text-white/40")}><step.icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0"><span className="block text-xs font-extrabold">{index + 1}. {step.label}</span><span className="mt-0.5 block text-[10px] leading-snug text-white/30">{step.caption}</span></span>
                  </div>
                ))}
              </div>
              <div className="mt-7 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/30">Production bible</p>
                <p className="mt-2 text-xs leading-relaxed text-white/45">Герой, костюм, локации и continuity фиксируются до генерации.</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.09]"><div className="h-full w-3/4 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" /></div>
                <p className="mt-2 text-[10px] font-bold text-white/35">6/8 настроено</p>
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setWorkspaceMode("projects")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/60 transition hover:border-white/25 hover:text-white lg:hidden" aria-label="Назад к проектам"><ArrowLeft className="h-4 w-4" /></button>
                  <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Cinema Studio / Generate</p><h2 className="mt-1 text-lg font-extrabold">{project ? "Раскадровка проекта" : "Новый AI режиссёрский проект"}</h2></div>
                </div>
                <div className="flex items-center gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/55 transition hover:border-white/25 hover:text-white"><SlidersHorizontal className="h-3.5 w-3.5" /> Filter</button><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/55 transition hover:border-white/25 hover:text-white"><Grid2X2 className="h-3.5 w-3.5" /> View</button></div>
              </div>

      <section id="director-form" className={cn("pg-product-hero-surface scroll-mt-24 rounded-2xl px-4 py-8 sm:py-10", embedded && "px-0 py-0")}>
        {embedded && isAuthenticated && (savedProjects.length > 0 || savedProjectsLoading) && (
          <div className="mx-auto mb-6 max-w-[1720px] rounded-2xl border border-[#dfe1f1] bg-white/85 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-[#7048ff]" />
                <h2 className="font-extrabold text-[#202039]">Мои AI режиссёрские проекты</h2>
              </div>
              {savedProjectsLoading && <Loader2 className="h-4 w-4 animate-spin text-[#7048ff]" />}
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {savedProjects.map((item) => (
                <button
                  key={item.projectId}
                  type="button"
                  onClick={() => void loadSavedProject(item.projectId)}
                  className="rounded-xl border border-[#e4e6f2] bg-[#fbfbff] p-3 text-left transition hover:border-[#7048ff] hover:bg-white"
                >
                  <p className="truncate text-sm font-extrabold text-[#202039]">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-[#747796]">{item.selectedIdeaTitle}</p>
                  <p className="mt-2 text-xs font-bold text-[#7048ff]">
                    {item.scenesReady}/{item.totalScenes || item.scenesReady} сцен · {item.mode === "clip" ? "клип" : "фильм"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto grid w-full min-w-0 max-w-[1720px] items-start gap-8 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <div className="pg-mobile-inline-contain min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_55px_rgba(37,35,89,0.10)] backdrop-blur sm:p-7">
            <div className="mb-4 flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="pg-product-hero-badge inline-flex items-center gap-2 rounded-full border border-[#ddd7fb] bg-[#f2edff] px-3 py-1 text-xs font-extrabold text-[#7048ff]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI режиссёр
                </div>
                <h1 className="pg-product-hero-title mt-4 text-[#202039]">
                  {form.mode === "clip" ? "Сценарий клипа и промпты по песне" : "Сцена фильма и промпты по сценарию"}
                </h1>
                {!embedded && (
                  <div className="mt-4">
                    <LearningModeToggle size="sm" />
                  </div>
                )}
              </div>
              <button
                type="button"
                data-learn-tip="Заполняет форму примером, чтобы быстро увидеть сценарий работы AI-режиссёра."
                onClick={useSample}
                className="pg-product-secondary-action inline-flex w-full shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-extrabold transition sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                Заполнить пример
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#dfe1f1] bg-[#f8f8ff] p-1">
              {[
                { id: "clip" as const, label: "Клип", icon: Music2 },
                { id: "film" as const, label: "Фильм", icon: Film },
              ].map((mode) => (
	                <button
	                  key={mode.id}
	                  type="button"
                    data-learn-tip="Выберите, что готовите: клип по песне или сцену фильма."
	                  onClick={() => changeMode(mode.id)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-extrabold transition",
                    form.mode === mode.id
                      ? "bg-white text-[#7048ff] shadow-sm ring-1 ring-[#7048ff]/45"
                      : "text-[#747796] hover:bg-white/70",
                  )}
                >
                  <mode.icon className="h-4 w-4" />
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-5">
              {directorTemplates.map((template) => (
	                <button
	                  key={template.id}
	                  type="button"
                    data-learn-tip="Шаблон быстро задаёт жанр, визуальный стиль, локации и правила сценария."
	                  onClick={() => applyTemplate(template)}
                  className="min-w-0 rounded-xl border border-[#e1ddfb] bg-white px-2.5 py-2.5 text-center text-[11px] font-extrabold leading-tight text-[#5d55a0] transition hover:border-[#7048ff] hover:text-[#7048ff] sm:text-xs"
                >
                  <span className="block min-w-0 max-w-full hyphens-auto [overflow-wrap:anywhere]">
                    {template.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden">
              <label className="grid w-full min-w-0 max-w-full gap-1.5">
                <FieldLabel>Название</FieldLabel>
                <input
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  className="w-full min-w-0 max-w-full rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                  placeholder={form.mode === "clip" ? "Название песни" : "Название сцены"}
                />
              </label>

              <label className="grid w-full min-w-0 max-w-full gap-1.5">
                <FieldLabel>{form.mode === "clip" ? "Текст песни" : "Описание сцены или сценарий"}</FieldLabel>
	                <textarea
                    data-learn-tip="Основной материал для режиссёра: текст песни, сюжет, сцена или подробное описание."
	                  value={form.sourceText}
                  onChange={(e) => update("sourceText", e.target.value)}
                  rows={7}
	                  className="w-full min-w-0 max-w-full resize-y rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm leading-relaxed outline-none ring-[#7048ff]/20 transition focus:ring-4"
                  placeholder={form.mode === "clip" ? "[Intro] ...\n[Verse] ...\n[Chorus] ..." : "Опишите сцену, героев, конфликт и финал"}
                />
              </label>

              <div className="grid min-w-0 max-w-full gap-3 sm:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
                <label className="grid w-full min-w-0 max-w-full gap-1.5">
                  <FieldLabel>Длительность, сек</FieldLabel>
                  <input
                    type="number"
                    min={VIDEO_DIRECTOR_MIN_DURATION_SEC}
                    max={VIDEO_DIRECTOR_MAX_DURATION_SEC}
                    value={form.durationSec}
                    onChange={(e) => update("durationSec", Number(e.target.value) || VIDEO_DIRECTOR_MIN_DURATION_SEC)}
                    onBlur={() => update("durationSec", normalizeVideoDirectorDuration(form.durationSec))}
                    className="w-full min-w-0 max-w-full rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                  />
                </label>
                <div className="grid min-w-0 max-w-full gap-1.5">
                  <FieldLabel>Аудио для длительности</FieldLabel>
	                  <div
	                    role="button"
	                    tabIndex={0}
                      data-learn-tip="Аудио помогает подстроить длительность, BPM и монтажные отрезки под реальный трек."
	                    onClick={() => audioInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        audioInputRef.current?.click();
                      }
                    }}
                    onDrop={handleAudioDrop}
                    onDragOver={(event) => handleAudioDrag(event, true)}
                    onDragEnter={(event) => handleAudioDrag(event, true)}
                    onDragLeave={(event) => handleAudioDrag(event, false)}
                    className={cn(
                      "grid min-h-[86px] min-w-0 max-w-full cursor-pointer grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-dashed bg-white px-3 py-3 transition",
                      audioDragActive
                        ? "border-[#7048ff] bg-[#f7f3ff] shadow-[0_0_0_4px_rgba(112,72,255,0.10)]"
                        : "border-[#cfd5f3] hover:border-[#7048ff]/70 hover:bg-[#fbfbff]",
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eefaff] text-[#0aaee8]">
                      <UploadCloud className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-[#202039]">
                        Перетащите аудио сюда
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#747796]">
                        {audioFileName}
                      </span>
                      <span className="mt-2 inline-flex rounded-lg bg-[#f3edff] px-3 py-1.5 text-xs font-extrabold text-[#7048ff]">
                        Выбрать файл
                      </span>
                    </span>
                    <input
                      ref={audioInputRef}
                      type="file"
                      aria-label="Загрузить аудио для длительности"
                      accept="audio/*,video/mp4"
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        handleAudioFile(event);
                        event.currentTarget.value = "";
                      }}
                      className="sr-only"
                    />
                  </div>
                  {(audioAnalyzing || audioSummary) && (
                    <span className="text-xs font-semibold text-[#747796]">
                      {audioAnalyzing ? "Анализируем BPM, тональность и LUFS..." : `Аудио: ${audioSummary}`}
                    </span>
                  )}
                </div>
              </div>

              <ProductionBiblePrepPanel
                readiness={preGenerationReadiness}
                rules={bibleRulePresets}
                onApplyRule={applyProductionBibleRule}
              />

              <div className="grid gap-1.5">
                <FieldLabel>{form.mode === "clip" ? "Вокал и герой" : "Герои"}</FieldLabel>
                <div className="-mx-1 mb-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2">
                  {characterPresets.map((preset) => (
	                    <button
	                      key={preset.id}
	                      type="button"
                        data-learn-tip="Пресет героя задаёт character bank: внешность, роль, поведение и эмоциональную дугу."
	                      onClick={() => applyCharacterPreset(preset)}
                      title={preset.profile}
                      className={cn(
                        "min-h-[134px] w-[168px] shrink-0 rounded-2xl border bg-[#fbfaff] px-3 py-3 text-left transition hover:border-[#7048ff] hover:bg-white hover:shadow-sm sm:w-[182px]",
                        selectedCharacterPresetId === preset.id
                          ? "border-[#7048ff] ring-2 ring-[#7048ff]/15"
                          : "border-[#e1ddfb]",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 text-sm font-extrabold leading-tight text-[#514a90]">
                          {preset.label}
                        </span>
                        <span className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          selectedCharacterPresetId === preset.id ? "bg-[#7048ff]" : "bg-[#d8d7ef]",
                        )} />
                      </span>
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[#8a8da8]">
                        {preset.hint}
                      </span>
                      <span className="mt-2 line-clamp-2 text-[11px] leading-snug text-[#666982]">
                        {preset.profile}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Профиль вокалиста"
                  value={form.vocalProfile}
                  onChange={(e) => update("vocalProfile", e.target.value)}
                  className="rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                />
              </div>

              <div className="grid gap-1.5">
                <FieldLabel>Операторский пресет</FieldLabel>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {CINEMATOGRAPHY_PRESETS.map((preset) => (
	                    <button
	                      key={preset.id}
	                      type="button"
                        data-learn-tip="Операторский пресет задаёт камеру, свет и визуальный язык сцен."
	                      onClick={() => applyCinematographyPreset(preset)}
                      title={`${preset.camera}. ${preset.lens}. ${preset.lighting}`}
                      className={cn(
                        "min-w-0 rounded-2xl border bg-white px-3 py-3 text-left transition hover:border-[#7048ff] hover:shadow-sm",
                        selectedCinematographyPresetId === preset.id
                          ? "border-[#7048ff] bg-[#fbf8ff] ring-2 ring-[#7048ff]/15"
                          : "border-[#e1ddfb]",
                      )}
                    >
                      <span className="flex items-center gap-2 text-xs font-extrabold text-[#202039]">
                        <Camera className="h-4 w-4 shrink-0 text-[#7048ff]" />
                        <span className="min-w-0 truncate">{preset.label}</span>
                      </span>
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[#8a8da8]">
                        {preset.hint}
                      </span>
                      <span className="mt-2 grid gap-1 text-[11px] leading-snug text-[#666982]">
                        <span className="line-clamp-1">Камера: {preset.camera}</span>
                        <span className="line-clamp-1">Свет: {preset.lighting}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <FieldLabel>Энергия</FieldLabel>
                  <input
                    value={form.energy}
                    onChange={(e) => update("energy", e.target.value)}
                    className="rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Модель</FieldLabel>
                  <select
                    value={form.targetModel}
                    onChange={(e) => update("targetModel", e.target.value)}
                    className="rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                  >
                    {MODEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5">
                <FieldLabel>Стиль</FieldLabel>
                <select
                  value={form.visualStyle}
                  onChange={(e) => update("visualStyle", e.target.value)}
                  className="rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                >
                  {STYLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <FieldLabel>Локации</FieldLabel>
                <input
                  value={form.locations}
                  onChange={(e) => update("locations", e.target.value)}
                  className="rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                />
              </label>

              <div className="grid gap-3 lg:grid-cols-2">
                <label className="grid gap-1.5">
                  <FieldLabel>Визуальные правила и референсы</FieldLabel>
                  <textarea
                    value={form.referenceNotes}
                    onChange={(e) => update("referenceNotes", e.target.value)}
                    rows={4}
                    className="resize-y rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                    placeholder="лицо, костюм, свет, символы текста, референсы и визуальные правила"
                  />
                </label>
                <label className="grid gap-1.5">
                  <FieldLabel>Запреты и continuity</FieldLabel>
                  <textarea
                    value={form.constraints}
                    onChange={(e) => update("constraints", e.target.value)}
                    rows={4}
                    className="resize-y rounded-xl border border-[#dfe1f1] bg-white px-3 py-2.5 text-sm outline-none ring-[#7048ff]/20 transition focus:ring-4"
                    placeholder="same face, same costume, no random text, no logos, no invented places"
                  />
                </label>
              </div>

              <ReferenceSlotsInput
                files={referenceSlotFiles}
                activeSlot={activeReferenceSlot}
                onSlotDrag={setActiveReferenceSlot}
                onSlotFile={attachReferenceSlot}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              data-learn-tip="Генерирует 5 режиссёрских идей; после выбора появятся сцены и промпты для видеомоделей."
              disabled={
                loadingIdeas
                || form.sourceText.trim().length < 20
                || form.durationSec < VIDEO_DIRECTOR_MIN_DURATION_SEC
                || form.durationSec > VIDEO_DIRECTOR_MAX_DURATION_SEC
              }
              onClick={generateIdeas}
              className="pg-product-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 font-extrabold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loadingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Получить 5 идей
            </button>
            <p className="mt-2 text-center text-sm font-semibold text-[#7b7fa2]">
              {inputStats.scenes} сцен по 10 секунд · {inputStats.chars} символов
            </p>
          </div>

          <DirectorAnalysisCard
            analysis={analysis}
            ideas={ideas}
            selectedIdeaId={selectedIdeaId}
            project={project}
            durationSec={form.durationSec}
            mode={form.mode}
            loadingStoryboard={loadingStoryboard}
            onSelectIdea={buildStoryboard}
            onCopyPrompt={copyPrimaryPrompt}
          />
        </div>

      </section>

      {project && (
        <section id="storyboard" className={cn("min-w-0 max-w-full overflow-hidden px-4 pb-14", embedded && "px-0")}>
          <div className="mx-auto max-w-[1720px] min-w-0 space-y-4">
            <div className="min-w-0 rounded-2xl border border-[#dfe1f1] bg-white/92 p-5 shadow-sm">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#7048ff]">Выбрано: {project.selectedIdea.title}</p>
                  <h2 className="mt-1 text-2xl font-extrabold text-[#202039]">AI studio: storyboard, assets и prompt-ready сцены</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#666982]">
                    {project.selectedIdea.logline}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={pdfLoading || unlocking}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dfe1f1] bg-white px-4 py-3 font-extrabold text-[#202039] shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  PDF production pack
                </button>
                <button
                  type="button"
                  onClick={() => void renderFullVideo()}
                  disabled={renderLoading || unlocking || !project.unlocked}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7048ff] px-4 py-3 font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {renderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                  Сгенерировать видео H3
                </button>
              </div>
              <div className="mt-5 grid gap-3 border-t border-[#dfe1f1] pt-5 md:grid-cols-[1fr_180px]">
                <label className="block text-xs font-bold text-[#666982]">
                  Озвучка NeuralDeep · текст диктора (необязательно)
                  <textarea value={voiceoverText} onChange={(event) => setVoiceoverText(event.target.value)} maxLength={5000} rows={3} placeholder="Текст озвучки для готового фильма…" className="mt-2 w-full rounded-xl border border-[#dfe1f1] bg-white px-3 py-2 text-sm text-[#202039]" />
                </label>
                <label className="block text-xs font-bold text-[#666982]">
                  Голос
                  <select value={voiceoverVoice} onChange={(event) => setVoiceoverVoice(event.target.value as typeof TTS_VOICES[number])} className="mt-2 w-full rounded-xl border border-[#dfe1f1] bg-white px-3 py-2 text-sm text-[#202039]">
                    {TTS_VOICES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-[#666982] md:col-span-2">
                  Манера речи
                  <input value={voiceoverStyle} onChange={(event) => setVoiceoverStyle(event.target.value)} maxLength={300} className="mt-2 w-full rounded-xl border border-[#dfe1f1] bg-white px-3 py-2 text-sm text-[#202039]" />
                </label>
              </div>
            </div>

            {renderJob && (
              <div className="rounded-2xl border border-[#7048ff]/25 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-[#202039]">MiniMax H3: {renderJob.stage || renderJob.status}</p>
                    <p className="mt-1 text-sm text-[#666982]">
                      Сцены: {renderJob.completedScenes || 0}/{renderJob.totalScenes || project.scenes.length}. Очередь работает на RTX 4090.
                    </p>
                  </div>
                  {renderJob.status === "completed" && renderJob.finalUrl && (
                    <a href={renderJob.finalUrl} className="inline-flex items-center gap-2 rounded-xl bg-[#171735] px-4 py-2.5 text-sm font-extrabold text-white" download>
                      <Download className="h-4 w-4" /> Скачать MP4
                    </a>
                  )}
                </div>
                {renderJob.status === "failed" && <p className="mt-3 text-sm font-semibold text-rose-600">{renderJob.error || "Рендер завершился ошибкой"}</p>}
                {renderJob.status === "completed" && renderJob.finalUrl && <video className="mt-4 w-full max-w-3xl rounded-xl bg-black" controls preload="metadata" src={renderJob.finalUrl} />}
              </div>
            )}

            <div className="grid min-w-0 gap-4">
              <StoryboardStudio
                project={project}
                activeSceneId={activeSceneId}
                saving={savingScenes}
                saveStatus={sceneSaveStatus}
                onActiveSceneChange={setActiveSceneId}
                onSceneChange={updateScene}
                onSceneReorder={reorderScenes}
                onSave={() => void saveStoryboardScenes()}
              />
              <HiddenScenesGate
                lockedCount={project.lockedCount}
                hasEnoughTokens={hasEnoughTokens}
                loading={unlocking}
                onUnlock={unlock}
              />
            </div>

            {widgetToken && (
              <div className="rounded-2xl border border-[#7048ff]/25 bg-white p-4 shadow-lg">
                <div className="mb-3 flex items-start gap-3 rounded-xl bg-[#f8f4ff] px-3 py-3">
                  <FileText className="mt-0.5 h-5 w-5 text-[#7048ff]" />
                  <div>
                    <p className="font-extrabold text-[#202039]">Production pack за {PRICE_RUB} ₽</p>
                    <p className="text-sm text-[#666982]">После оплаты откроем все сцены, editable storyboard, reorder, PDF и историю проекта.</p>
                  </div>
                </div>
                <Suspense fallback={<div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin text-[#7048ff]" /></div>}>
                  <YooKassaWidget
                    confirmationToken={widgetToken}
                    onSuccess={onPaymentSuccess}
                    onError={() => setError("Ошибка оплаты. Попробуйте ещё раз.")}
                  />
                </Suspense>
                <button
                  type="button"
                  onClick={() => setWidgetToken(null)}
                  className="mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold text-[#666982] hover:bg-[#f8f8ff]"
                >
                  Закрыть оплату
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {!embedded && (
        <section className="px-4 pb-8">
          <div className="mx-auto flex max-w-[1720px] items-start gap-4 rounded-2xl border border-[#dfe1f1] bg-white/70 p-5 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7048ff] to-[#22c7f2] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-[#202039]">AI режиссёр для сайта: сценарии клипов и prompt-ready сцены</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#666982]">
                Пользователь получает 5 идей, выбирает направление, видит первые две сцены бесплатно, а полный сценарий с PDF открывает за разовую оплату или токены.
              </p>
            </div>
          </div>
        </section>
      )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
