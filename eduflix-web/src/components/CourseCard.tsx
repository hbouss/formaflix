import { useEffect, useRef, useState } from "react";
import type {CourseLite} from "../api/types";
import { Link } from "react-router-dom";

export default function CourseCard({
  course,
  owned = false, // ← mode bibliothèque
}: { course: CourseLite; owned?: boolean }) {
  const [hover, setHover] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hover) v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hover]);

  return (
    <div
      className="group relative shrink-0 w-[230px] sm:w-[260px] aspect-video rounded-md overflow-hidden bg-black cursor-pointer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* image de fond */}
      <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />

      {/* preview vidéo */}
      <video
        ref={videoRef}
        src={course.trailer_src}
        muted
        playsInline
        loop
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 ${
          hover ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* overlay infos + boutons */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-end p-3 transition-colors duration-200
        ${hover ? "bg-gradient-to-t from-black/80 to-transparent" : "bg-gradient-to-t from-black/70 to-transparent"}`}
      >
        <div className="font-semibold line-clamp-1">{course.title}</div>
        <div className="text-[12px] opacity-80">
          {owned ? "Accès inclus" : `${(course.price_cents / 100).toFixed(2)} €`}
        </div>
        <div className={`mt-2 flex items-center gap-2 transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}>
          <Link
            to={owned ? `/player/${course.id}` : `/course/${course.id}`}
            className="px-2 py-1 text-[12px] rounded bg-white text-black hover:bg-neutral-200 font-semibold"
          >
            {owned ? "Lecture" : "Aperçu"}
          </Link>
          <Link
            to={`/course/${course.id}`}
            className="px-2 py-1 text-[12px] rounded bg-white/20 hover:bg-white/30"
          >
            Infos
          </Link>
        </div>
      </div>

      {/* calque décoratif (ne doit PAS capter les clics) */}
      <div
        className={`absolute inset-0 rounded-md ring-1 ring-white/10 transition-transform duration-200 pointer-events-none z-0
        ${hover ? "scale-[1.06] shadow-2xl" : ""}`}
      />
    </div>
  );
}