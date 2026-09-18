import { describe, expect, it } from "vitest";
import { fallbackStoryboard, getVideoDirectorSceneCount, makeVideoDirectorProject, serializeVideoDirectorProject, type VideoDirectorAnalysis, type VideoDirectorIdea, type VideoDirectorInput } from "@/lib/ai-video-director";
import { buildModelPromptVariant, buildProductionBible } from "@/lib/ai-video-director-production-bible";

const input: VideoDirectorInput = {
  mode: "clip", title: "Ночной город", sourceText: "[Intro]\nНочной город дышит тише.\n[Chorus]\nВыше к свету, пусть весь город слышит нас.", durationSec: 56,
  vocalProfile: "девушка lead vocal, один центральный образ", energy: "мощная", visualStyle: "реалистичный live action",
  locations: "ночная улица, студия, открытый финал", referenceNotes: "натуральное лицо, единый костюм", constraints: "без логотипов, без случайного текста", targetModel: "Kling",
};
const analysis: VideoDirectorAnalysis = { language: "русский", mood: "от тьмы к свету", energy: "мощная", structure: ["Интро", "Припев"], keyImages: ["свет", "город"], directorNote: "Держать связь текста и образов." };
const idea: VideoDirectorIdea = { id: "performance-story", title: "Performance + смысл текста", logline: "Артист ведёт клип через performance.", visualStyle: "realistic cinematic", locations: ["ночная улица"], whyItFits: "Понятная структура.", rules: ["один герой"] };

describe("standalone AI director core", () => {
  it("keeps the 10-second scene contract and two-scene preview", () => {
    expect(getVideoDirectorSceneCount(input)).toBe(6);
    const project = makeVideoDirectorProject(input, analysis, [idea], idea, fallbackStoryboard(input, analysis, idea));
    const preview = serializeVideoDirectorProject(project, false);
    expect(preview.scenes).toHaveLength(2);
    expect(preview.lockedCount).toBe(4);
  });

  it("emits diverse grounded prompts and a production bible", () => {
    const scenes = fallbackStoryboard(input, analysis, idea);
    expect(new Set(scenes.map((scene) => scene.prompt)).size).toBe(scenes.length);
    expect(scenes.every((scene) => scene.prompt.includes("Lead character:") && scene.negativePrompt.length > 0)).toBe(true);
    const project = makeVideoDirectorProject(input, analysis, [idea], idea, scenes);
    expect(buildProductionBible(project).beats.length).toBeGreaterThan(0);
    expect(buildModelPromptVariant(scenes[0], project, "kling")).toContain("Kling adapter");
  });
});
