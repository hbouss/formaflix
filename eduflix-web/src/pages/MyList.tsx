import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Navbar from "../components/Navbar";
import RowCarousel from "../components/RowCarousel";
import CourseModal from "../components/CourseModal";
import type { FavoriteItem, CourseLite } from "../api/types";
import { useTranslation } from "react-i18next";
import MobileTabbar from "../components/MobileTabbar";

export default function MyList() {
  const { t } = useTranslation();

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const ownedById = useMemo(
    () => Object.fromEntries([...ownedIds].map((id) => [id, true])) as Record<number, boolean>,
    [ownedIds]
  );

  const [modalCourseId, setModalCourseId] = useState<number | null>(null);

  useEffect(() => {
    client.get("/learning/my-list/").then((r) => setItems(r.data)).catch(() => {});
    client
      .get("/learning/my-library/")
      .then((r) => {
        const s = new Set<number>((r.data as any[]).map((e: any) => e.course.id));
        setOwnedIds(s);
      })
      .catch(() => setOwnedIds(new Set()));
  }, []);

  const courses: CourseLite[] = items.map((i) => i.course);

  const openInfoIfNotOwned = (c: CourseLite) => {
    if (ownedIds.has(c.id)) return;
    setModalCourseId(c.id);
  };

  return (
    <div
      className="bg-[#141414] min-h-screen text-white"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Navbar />
      <main className="max-w-[1500px] mx-auto px-6 pt-[96px] md:pt-[104px]">
        <RowCarousel title={t("nav.myList")} items={courses} ownedById={ownedById} onInfo={openInfoIfNotOwned} />

        {items.length === 0 && (
          <p className="mt-6 opacity-80">
            {t("myList.empty", { defaultValue: "Votre liste est vide pour le moment." })}
          </p>
        )}
      </main>

      {modalCourseId !== null && <CourseModal courseId={modalCourseId} onClose={() => setModalCourseId(null)} />}

      <MobileTabbar />
    </div>
  );
}