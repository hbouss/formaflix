import { useEffect, useRef, useState } from "react";
import type { CourseLite, ContinueItem } from "../api/types";
import CourseCard from "./CourseCard";
import client from "../api/client";

type ResumeInfo = { percent: number; resume_position_seconds: number };

export default function RowCarousel({
  title,
  items,
  owned = false, // 👈 mode bibliothèque / accès
  ranked = false,   // 👈 nouveau
}: { title: string; items: CourseLite[]; owned?: boolean; ranked?: boolean; }) {
  const ref = useRef<HTMLDivElement>(null);

  // ✅ progression par course.id (uniquement pour "Continuer à regarder")
  const [resumeById, setResumeById] = useState<Record<number, ResumeInfo>>({});

  useEffect(() => {
    // On ne fetch la progression QUE pour la rangée "Continuer à regarder"
    const isContinue = title.toLowerCase().includes("continuer");
    if (!owned || !isContinue) {
      setResumeById({});
      return;
    }
    client
      .get<ContinueItem[]>("/learning/continue-watching/")
      .then(({ data }) => {
        const map: Record<number, ResumeInfo> = {};
        for (const ci of data) {
          map[ci.course.id] = {
            percent: ci.percent,
            resume_position_seconds: ci.resume_position_seconds,
          };
        }
        setResumeById(map);
      })
      .catch(() => setResumeById({}));
  }, [title, owned]);

  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    const delta = ref.current.clientWidth * 0.9;
    ref.current.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" });
  };

  return (
    <div className="relative my-8">
      <h3 className="text-[18px] md:text-xl font-semibold mb-2 px-6">{title}</h3>

      <button
        onClick={() => scroll("left")}
        className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80"
        aria-label="Défiler à gauche"
      >
        ‹
      </button>
      <button
        onClick={() => scroll("right")}
        className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80"
        aria-label="Défiler à droite"
      >
        ›
      </button>

      <div ref={ref} className="flex gap-3 overflow-x-auto px-6 pb-2 scroll-smooth snap-x">
        {items.map((c, i) => (
          <div key={c.id} className="snap-start">
            {ranked && (
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-[120px] md:text-[180px] font-black text-white/5 pointer-events-none select-none leading-none">
                {i + 1}
              </div>
            )}
            <CourseCard
              course={c}
              owned={owned}
              // ✅ on ne passe la reprise que si elle existe dans la map
              resume={resumeById[c.id]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}