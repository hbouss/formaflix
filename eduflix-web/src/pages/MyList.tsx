// src/pages/MyList.tsx
import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Navbar from "../components/Navbar";
import RowCarousel from "../components/RowCarousel";
import CourseModal from "../components/CourseModal";
import type { FavoriteItem, CourseLite } from "../api/types";
import { useTranslation } from "react-i18next";
import MobileTabbar from "../components/MobileTabbar";
import { useAuth } from "../store/auth";

export default function MyList() {
  const { t } = useTranslation();
  const { token } = useAuth();

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
        const s = new Set<number>((r.data as any[]).map((e: any) => e?.course?.id));
        setOwnedIds(s);
      })
      .catch(() => setOwnedIds(new Set()));
  }, []);

  const courses: CourseLite[] = items.map((i) => i.course);

  const openInfoIfNotOwned = (c: CourseLite) => {
    if (ownedIds.has(c.id)) return;
    setModalCourseId(c.id);
  };

  const buyFromList = async (c: CourseLite) => {
    if (!token) {
      alert(t("alerts.loginToBuy", { defaultValue: "Connecte-toi pour acheter" }));
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: c.id });
    window.location.href = data.checkout_url;
  };

  return (
    <div
      className="bg-black min-h-screen text-white relative overflow-x-hidden"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Navbar />

      {/* BACKDROP décoratif, comme les autres pages */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0b0b0b] to-black" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-[80vw] max-w-5xl rounded-full blur-3xl opacity-30 bg-red-600/20" />
      </div>

      <main className="max-w-[1500px] mx-auto px-6 pt-[96px] md:pt-[104px] pb-10">
        <RowCarousel
          title={t("nav.myList")}
          items={courses}
          ownedById={ownedById}
          onInfo={openInfoIfNotOwned}
          onBuy={buyFromList}
        />

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