"use client";

export function LearningModeToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  return <span className={`inline-flex items-center rounded-full border border-[#ddd7fb] bg-[#f8f4ff] px-3 py-1 text-xs font-bold text-[#7048ff] ${size === "md" ? "text-sm" : ""}`}>Режим обучения</span>;
}
