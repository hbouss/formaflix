// src/components/Hero.tsx
import type { CourseLite } from "../api/types";

export default function Hero({
  course,
  onBuy,
}: { course?: CourseLite; onBuy?: () => void }) {
  if (!course) return <div className="h-[35vh]" />;

  const bg = course.thumbnail; // ou hero_banner si dispo

  return (
    <div className="relative h-[68vh] w-full">
      <img src={bg} className="absolute inset-0 w-full h-full object-cover object-center" alt={course.title} />

      {/* voiles */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] bg-gradient-to-b from-transparent via-black/60 to-black" />

      {/* ▼ contenu remonté */}
      <div className="relative z-10 max-w-[1500px] mx-auto px-6
                      pt-[20vh] md:pt-[24vh] lg:pt-[26vh]">
        <h1 className="text-4xl md:text-6xl font-extrabold max-w-3xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          {course.title}
        </h1>

        <p className="mt-3 max-w-2xl opacity-90 text-sm md:text-base leading-relaxed">
          {course.synopsis}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onBuy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white text-black font-semibold hover:bg-neutral-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="-ml-1"><path d="M8 5v14l11-7z" /></svg>
            Lecture / Acheter {(course.price_cents / 100).toFixed(2)} €
          </button>

          <a href={`/course/${course.id}`} className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white/20 hover:bg-white/30">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 7v5l4 2" /></svg>
            Plus d'infos
          </a>
        </div>
      </div>
    </div>
  );
}