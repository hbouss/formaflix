import type {CourseLite} from "../api/types";

export default function Hero({ course, onBuy }: { course?: CourseLite; onBuy?: ()=>void }) {
  if (!course) return <div className="h-[35vh]" />;

  const bg = course.thumbnail; // ou hero_banner côté API si dispo

  return (
    <div className="relative h-[68vh] w-full">
      <img src={bg} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
      <div className="relative z-10 max-w-[1500px] mx-auto px-6 pt-28 md:pt-40">
        <h1 className="text-4xl md:text-6xl font-extrabold max-w-3xl drop-shadow-lg">{course.title}</h1>
        <p className="mt-4 max-w-2xl opacity-90 text-sm md:text-base leading-relaxed">{course.synopsis}</p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onBuy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white text-black font-semibold hover:bg-neutral-200"
          >
            {/* Icône Lecture */}
            <svg width="18" height="18" viewBox="0 0 24 24" className="-ml-1"><path d="M8 5v14l11-7z" /></svg>
            Lecture / Acheter {(course.price_cents/100).toFixed(2)} €
          </button>
          <a
            href={`/course/${course.id}`}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-white/20 hover:bg-white/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 7v5l4 2" /></svg>
            Plus d'infos
          </a>
        </div>
      </div>
    </div>
  );
}