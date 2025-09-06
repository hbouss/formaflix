import { useRef } from "react";
import type {CourseLite} from "../api/types";
import CourseCard from "./CourseCard";

export default function RowCarousel({
  title,
  items,
  owned = false, // 👈
}: { title: string; items: CourseLite[]; owned?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    if (!ref.current) return;
    const delta = ref.current.clientWidth * 0.9;
    ref.current.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" });
  };

  return (
    <div className="relative my-8">
      <h3 className="text-[18px] md:text-xl font-semibold mb-2 px-6">{title}</h3>

      <button onClick={() => scroll("left")} className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80">‹</button>
      <button onClick={() => scroll("right")} className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/60 hover:bg-black/80">›</button>

      <div ref={ref} className="flex gap-3 overflow-x-auto px-6 pb-2 scroll-smooth snap-x">
        {items.map((c) => (
          <div key={c.id} className="snap-start">
            <CourseCard course={c} owned={owned} />
          </div>
        ))}
      </div>
    </div>
  );
}