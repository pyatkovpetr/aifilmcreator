import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import {
  VIDEO_DIRECTOR_PRICE_RUB,
  VIDEO_DIRECTOR_TOKEN_COST,
  formatTimestamp,
  type VideoDirectorProject,
} from "@/lib/ai-video-director";
import {
  buildModelPromptAdapters,
  buildProductionBible,
  buildSceneShotPlan,
  buildSceneTransitionNote,
} from "@/lib/ai-video-director-production-bible";

const PDF_BODY_FONT = "NotoSans";
const PDF_MONO_FONT = "NotoSansMono";
const PDF_TOP_Y = 18;
const PDF_BOTTOM_Y = 274;

type PdfFonts = { body: string; mono: string };

let cachedPdfFonts: Record<string, string> | null = null;

function resolvePublicFontPath(fileName: string): string | null {
  const candidates = [
    join(process.cwd(), "public", "fonts", fileName),
    join(process.cwd(), "saas-frontend", "public", "fonts", fileName),
  ];
  return candidates.find((path) => existsSync(path)) || null;
}

function loadPdfFont(fileName: string): string | null {
  const fontPath = resolvePublicFontPath(fileName);
  if (!fontPath) return null;
  return readFileSync(fontPath).toString("base64");
}

function registerPdfFonts(doc: jsPDF): PdfFonts {
  try {
    cachedPdfFonts ||= {
      "NotoSans-Regular.ttf": loadPdfFont("NotoSans-Regular.ttf") || "",
      "NotoSans-Bold.ttf": loadPdfFont("NotoSans-Bold.ttf") || "",
      "NotoSansMono-Regular.ttf": loadPdfFont("NotoSansMono-Regular.ttf") || "",
      "NotoSansMono-Bold.ttf": loadPdfFont("NotoSansMono-Bold.ttf") || "",
    };

    if (Object.values(cachedPdfFonts).some((data) => !data)) {
      throw new Error("PDF fonts are missing");
    }

    for (const [name, data] of Object.entries(cachedPdfFonts)) doc.addFileToVFS(name, data);
    doc.addFont("NotoSans-Regular.ttf", PDF_BODY_FONT, "normal");
    doc.addFont("NotoSans-Bold.ttf", PDF_BODY_FONT, "bold");
    doc.addFont("NotoSansMono-Regular.ttf", PDF_MONO_FONT, "normal");
    doc.addFont("NotoSansMono-Bold.ttf", PDF_MONO_FONT, "bold");
    return { body: PDF_BODY_FONT, mono: PDF_MONO_FONT };
  } catch (e) {
    console.warn("[ai-video-director/pdf] Falling back to built-in fonts", e);
    return { body: "helvetica", mono: "courier" };
  }
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let nextY = y;
  for (const line of lines) {
    nextY = ensurePage(doc, nextY, lineHeight);
    doc.text(line, x, nextY);
    nextY += lineHeight;
  }
  return nextY;
}

function ensurePage(doc: jsPDF, y: number, reserve = 0): number {
  if (y + reserve <= PDF_BOTTOM_Y) return y;
  doc.addPage();
  return PDF_TOP_Y;
}

function addSectionTitle(doc: jsPDF, fonts: PdfFonts, title: string, x: number, y: number, color: [number, number, number]): number {
  y = ensurePage(doc, y, 12);
  doc.setFont(fonts.body, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...color);
  doc.text(title, x, y);
  return y + 7;
}

export function generateVideoDirectorPdf(project: VideoDirectorProject): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fonts = registerPdfFonts(doc);
  const W = 210;
  const ML = 14;
  const MR = 196;
  let y = 16;
  const productTitle = project.input.mode === "clip" ? "AI режиссёр клипа" : "AI режиссёр сцены";
  const bible = buildProductionBible(project);

  const colors = {
    text: [28, 28, 46] as [number, number, number],
    muted: [100, 100, 130] as [number, number, number],
    violet: [124, 58, 237] as [number, number, number],
    cyan: [0, 150, 190] as [number, number, number],
    amber: [210, 110, 0] as [number, number, number],
    pale: [244, 246, 255] as [number, number, number],
  };

  doc.setFillColor(...colors.pale);
  doc.rect(0, 0, W, 42, "F");
  doc.setFont(fonts.body, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...colors.text);
  doc.text(productTitle, ML, y);
  y += 8;
  doc.setFont(fonts.body, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colors.muted);
  doc.text(`ПеснеГен · ${project.input.mode === "clip" ? "Клип по песне" : "Сцена фильма"} · ${project.scenes.length} сцен`, ML, y);
  y += 8;
  doc.setTextColor(...colors.violet);
  doc.text(`${VIDEO_DIRECTOR_PRICE_RUB} ₽ или ${VIDEO_DIRECTOR_TOKEN_COST} токенов · project ${project.projectId.slice(0, 8)}`, ML, y);

  y = 52;
  doc.setFont(fonts.body, "bold");
  doc.setFontSize(14);
  doc.setTextColor(...colors.text);
  doc.text(project.input.title || project.selectedIdea.title, ML, y);
  y += 8;
  doc.setFont(fonts.body, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colors.text);
  y = addWrappedText(doc, project.selectedIdea.logline, ML, y, MR - ML, 5);

  y += 4;
  doc.setFont(fonts.body, "bold");
  doc.setTextColor(...colors.cyan);
  doc.text("Анализ", ML, y);
  y += 6;
  doc.setFont(fonts.body, "normal");
  doc.setTextColor(...colors.text);
  const analysis = [
    `Язык: ${project.analysis.language}`,
    `Настроение: ${project.analysis.mood}`,
    `Энергия: ${project.analysis.energy}`,
    `Структура: ${project.analysis.structure.join(", ")}`,
    `Ключевые образы: ${project.analysis.keyImages.join(", ")}`,
    `Режиссёрское правило: ${project.analysis.directorNote}`,
  ].join("\n");
  y = addWrappedText(doc, analysis, ML, y, MR - ML, 5);

  y += 5;
  doc.setFont(fonts.body, "bold");
  doc.setTextColor(...colors.amber);
  doc.text("Выбранная концепция", ML, y);
  y += 6;
  doc.setFont(fonts.body, "normal");
  doc.setTextColor(...colors.text);
  y = addWrappedText(
    doc,
    `${project.selectedIdea.title}. ${project.selectedIdea.visualStyle}. Локации: ${project.selectedIdea.locations.join(", ")}. Правила: ${project.selectedIdea.rules.join("; ")}.`,
    ML,
    y,
    MR - ML,
    5,
  );

  y += 8;
  y = addSectionTitle(doc, fonts, "AI Production Bible", ML, y, colors.violet);
  doc.setFont(fonts.body, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...colors.text);
  y = addWrappedText(
    doc,
    `Готовность: ${bible.readiness.map((item) => `${item.label}: ${item.status === "ready" ? "готово" : "нужно уточнить"}`).join("; ")}.`,
    ML,
    y,
    MR - ML,
    4.7,
  );

  y += 3;
  doc.setFont(fonts.body, "bold");
  doc.setTextColor(...colors.cyan);
  doc.text("Character Bank", ML, y);
  y += 6;
  doc.setFont(fonts.body, "normal");
  doc.setTextColor(...colors.text);
  for (const item of bible.characters) {
    y = addWrappedText(doc, `${item.label}: ${item.value}`, ML, y, MR - ML, 4.7);
  }

  y += 3;
  doc.setFont(fonts.body, "bold");
  doc.setTextColor(...colors.cyan);
  doc.text("Asset Bible", ML, y);
  y += 6;
  doc.setFont(fonts.body, "normal");
  doc.setTextColor(...colors.text);
  const assetLines = [
    `Локации: ${bible.locations.map((item) => item.value).join("; ") || "не заданы"}`,
    `Костюмы: ${bible.costumes.map((item) => item.value).join("; ") || "не заданы"}`,
    `Реквизит/мотивы: ${[...bible.props, ...bible.motifs].map((item) => item.value).join("; ") || "не заданы"}`,
    `Запреты: ${bible.forbidden.map((item) => item.value).join("; ") || "без случайного текста, без смены лица"}`,
  ];
  for (const line of assetLines) {
    y = addWrappedText(doc, line, ML, y, MR - ML, 4.7);
  }

  y += 3;
  doc.setFont(fonts.body, "bold");
  doc.setTextColor(...colors.cyan);
  doc.text("Beat / Energy Timeline", ML, y);
  y += 6;
  doc.setFont(fonts.body, "normal");
  doc.setTextColor(...colors.text);
  for (const beat of bible.beats) {
    y = addWrappedText(
      doc,
      `${formatTimestamp(beat.startSec)}-${formatTimestamp(beat.endSec)} · ${beat.label} · ${beat.energy}: ${beat.goal}`,
      ML,
      y,
      MR - ML,
      4.7,
    );
  }

  y += 8;
  doc.setFont(fonts.body, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...colors.text);
  doc.text("Раскадровка и промпты", ML, y);
  y += 8;

  const modelAdapters = buildModelPromptAdapters();
  for (const [sceneIndex, scene] of project.scenes.entries()) {
    const nextScene = project.scenes[sceneIndex + 1];
    y = ensurePage(doc, y, 18);
    doc.setFillColor(250, 250, 255);
    doc.roundedRect(ML - 1, y - 5, MR - ML + 2, 10, 2, 2, "F");
    doc.setFont(fonts.body, "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colors.violet);
    doc.text(
      `${String(scene.id).padStart(2, "0")} · ${formatTimestamp(scene.startSec)}-${formatTimestamp(scene.endSec)} · ${scene.label}`,
      ML,
      y,
    );
    y += 9;

    doc.setFont(fonts.body, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.text);
    y = addWrappedText(doc, `Задача: ${scene.purpose}`, ML, y, MR - ML, 4.7);
    y = addWrappedText(doc, `Кадр: ${scene.visual}`, ML, y + 1, MR - ML, 4.7);
    y = addWrappedText(doc, `Действие: ${scene.action}`, ML, y + 1, MR - ML, 4.7);
    y = addWrappedText(doc, `Камера: ${scene.camera}`, ML, y + 1, MR - ML, 4.7);
    y = addWrappedText(doc, `Свет: ${scene.lighting}`, ML, y + 1, MR - ML, 4.7);
    y = addWrappedText(doc, `Переход: ${buildSceneTransitionNote(scene, nextScene)}`, ML, y + 1, MR - ML, 4.7);

    doc.setFont(fonts.body, "bold");
    doc.setTextColor(...colors.cyan);
    y = ensurePage(doc, y + 3, 8);
    doc.text("Shot plan", ML, y);
    y += 6;
    doc.setFont(fonts.body, "normal");
    doc.setTextColor(...colors.text);
    for (const shot of buildSceneShotPlan(scene)) {
      y = addWrappedText(
        doc,
        `${shot.label}: ${shot.action} Камера: ${shot.camera}. Свет: ${shot.lighting}.`,
        ML,
        y,
        MR - ML,
        4.5,
      );
    }

    doc.setFont(fonts.body, "bold");
    doc.setTextColor(...colors.amber);
    y = ensurePage(doc, y + 3, 8);
    doc.text("Model adapters", ML, y);
    y += 6;
    doc.setFont(fonts.body, "normal");
    doc.setTextColor(...colors.text);
    for (const adapter of modelAdapters) {
      y = addWrappedText(doc, `${adapter.label}: ${adapter.value}`, ML, y, MR - ML, 4.5);
    }

    y = ensurePage(doc, y + 3);
    doc.setFont(fonts.mono, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(35, 35, 52);
    y = addWrappedText(doc, `PROMPT: ${scene.prompt}`, ML, y, MR - ML, 4.2);
    doc.setTextColor(110, 70, 70);
    y = addWrappedText(doc, `NEGATIVE: ${scene.negativePrompt}`, ML, y + 1, MR - ML, 4.2);
    y += 7;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont(fonts.body, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(`ПеснеГен · ${productTitle} · ${i}/${pages}`, ML, 290);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
