import { useEffect, useRef, useState } from "react";
import type { CourseLite, ContinueItem } from "../api/types";
import CourseCard from "./CourseCard";
import client from "../api/client";

type ResumeInfo = { percent: number; resume_position_seconds: number };

export default function RowCarousel({
  title,
  items,
  owned = false,
  ranked = false,
  onInfo,
  ownedById,
}: {
  title: string;
  items: CourseLite[];
  owned?: boolean;
  ranked?: boolean;
  onInfo?: (c: CourseLite) => void;
  ownedById?: Record<number, boolean>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [resumeById, setResumeById] = useState<Record<number, ResumeInfo>>({});

  useEffect(() => {
    const isContinue = title.toLowerCase().includes("continuer");
    if (!owned || !isContinue) { setResumeById({}); return; }
    client.get<ContinueItem[]>("/learning/continue-watching/").then(({ data }) => {
      const map: Record<number, ResumeInfo> = {};
      data.forEach(ci => {
        map[ci.course.id] = { percent: ci.percent, resume_position_seconds: ci.resume_position_seconds };
      });
      setResumeById(map);
    }).catch(() => setResumeById({}));
  }, [title, owned]);

  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    const delta = ref.current.clientWidth * 0.9;
    ref.current.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" });
  };

  return (
    <section className="relative my-8">
      {/* Titre aligné à 4vw */}
      <h3 className="px-[4vw] text-[18px] md:text-xl font-semibold mb-2">{title}</h3>

      {/* Flèches façon Netflix, posées au bord du viewport */}
      <button
        onClick={() => scroll("left")}
        className="hidden md:flex items-center justify-center absolute left-[0.8vw] top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80"
        aria-label="Défiler à gauche"
      >
        ‹
      </button>
      <button
        onClick={() => scroll("right")}
        className="hidden md:flex items-center justify-center absolute right-[0.8vw] top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80"
        aria-label="Défiler à droite"
      >
        ›
      </button>

      {/* Piste scroll alignée à 4vw */}
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto px-[4vw] pb-2 scroll-smooth snap-x"
      >
        {items.map((c, idx) => {
          const isOwned = owned || !!ownedById?.[c.id];
          return (
            <div key={c.id} className="relative snap-start">
              {ranked && (
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-[120px] md:text-[180px] font-black text-white/5 pointer-events-none select-none leading-none">
                  {idx + 1}
                </div>
              )}
              <CourseCard
                course={c}
                owned={isOwned}
                resume={resumeById[c.id]}
                onInfo={isOwned ? undefined : onInfo}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}