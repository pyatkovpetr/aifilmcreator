import { Clapperboard, Clock3, FileText, Lightbulb, MessageSquareText, Sparkles } from "lucide-react";
import { AiVideoDirectorClient } from "@/app/ai-rezhisser-klipa/ai-video-director-client";

const FEATURES = [
  { icon: Lightbulb, label: "5 идей", desc: "Концепции клипа", color: "#7C3AED" },
  { icon: Clock3, label: "Таймкоды", desc: "Сцены по 10 секунд", color: "#00A6D6" },
  { icon: MessageSquareText, label: "Промпты", desc: "Для видеогенераторов", color: "#FF6B35" },
  { icon: Sparkles, label: "Negative", desc: "Что исключить", color: "#EC4899" },
  { icon: FileText, label: "PDF", desc: "Сценарий и раскадровка", color: "#34d399" },
  { icon: Clapperboard, label: "Клип/фильм", desc: "Два режима", color: "#f59e0b" },
];

export default function HomePage() {
  return (
    <main>
      <header className="border-b border-white/80 bg-white/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1720px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7048ff] to-[#00c8ee] text-white"><Clapperboard className="h-5 w-5" /></div>
            <div><p className="font-black tracking-tight text-[#202039]">AI режиссёр</p><p className="text-xs text-[#747796]">Клип · фильм · production pack</p></div>
          </div>
          <span className="hidden rounded-full bg-[#f0edff] px-3 py-1 text-xs font-bold text-[#7048ff] sm:inline-flex">Отдельный продукт</span>
        </div>
      </header>
      <section className="px-4 pb-2 pt-9 text-center sm:pt-14">
        <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight text-[#202039] sm:text-6xl">Сценарий клипа и промпты по песне</h1>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-[#666982] sm:text-lg">Создайте режиссёрские идеи, раскадровку по таймкодам и готовые промпты для клипа или сцены фильма.</p>
        <div className="mx-auto mt-7 grid max-w-5xl grid-cols-2 gap-3 text-left sm:grid-cols-3 lg:grid-cols-6">
          {FEATURES.map(({ icon: Icon, label, desc, color }) => <div key={label} className="rounded-2xl border border-white bg-white/85 p-3 shadow-sm"><Icon className="h-5 w-5" style={{ color }} /><p className="mt-2 text-sm font-extrabold text-[#202039]">{label}</p><p className="text-xs text-[#747796]">{desc}</p></div>)}
        </div>
      </section>
      <AiVideoDirectorClient />
      <footer className="border-t border-[#dfe1f1] px-4 py-7 text-center text-sm text-[#747796]">AI режиссёр · готовые материалы для Kling, Veo, Runway и Seedance</footer>
    </main>
  );
}
