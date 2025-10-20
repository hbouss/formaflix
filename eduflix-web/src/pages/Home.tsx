import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import type { CourseLite, ContinueItem, HomeRails } from "../api/types";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import RowCarousel from "../components/RowCarousel";
import { useAuth } from "../store/auth";
import CourseModal from "../components/CourseModal";
import MobileTabbar from "../components/MobileTabbar";

export default function Home() {
  const { t } = useTranslation();
  const nav = useNavigate();

  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [rails, setRails] = useState<Partial<HomeRails>>({});
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const ownedById = useMemo(
    () => Object.fromEntries([...ownedIds].map((id) => [id, true])) as Record<number, boolean>,
    [ownedIds]
  );
  const [modalCourseId, setModalCourseId] = useState<number | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    client.get("/catalog/courses/").then((res) => setCourses(res.data));
  }, []);
  useEffect(() => {
    client.get<HomeRails>("/catalog/home-rails/").then(({ data }) => setRails(data));
  }, []);
  useEffect(() => {
    if (!token) {
      setContinueItems([]);
      setOwnedIds(new Set());
      return;
    }
    client
      .get("/learning/continue-watching/")
      .then((res) => setContinueItems(res.data))
      .catch(() => {});
    client
      .get("/learning/my-library/")
      .then((r) => {
        const s = new Set<number>((r.data as any[]).map((e: any) => e.course.id));
        setOwnedIds(s);
      })
      .catch(() => setOwnedIds(new Set()));
  }, [token]);

  const featured = courses[0];

  const buyFeatured = async () => {
    if (!featured) return;
    if (!token) {
      alert(t("alerts.loginToBuy"));
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: featured.id });
    window.location.href = data.checkout_url;
  };

  const openInfoIfNotOwned = (c: CourseLite) => {
    if (ownedIds.has(c.id)) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches || /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
      nav(`/info/${c.id}`);
    } else {
      setModalCourseId(c.id);
    }
  };

  return (
    <div
      className="relative min-h-dvh bg-black text-white"
      // réserve d’espace pour la tabbar mobile (56px) + safe-area iOS
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Navbar />
      <Hero course={featured} onBuy={buyFeatured} />

      <div className="-mt-[12vh] sm:-mt-[12vh] md:-mt-[10vh] lg:-mt-[13vh] space-y-8 md:space-y-10">
        {rails.top10?.length ? (
          <RowCarousel
            title={t("home.top10Today")}
            items={rails.top10}
            ranked
            ownedById={ownedById}
            onInfo={openInfoIfNotOwned}
          />
        ) : null}

        {continueItems.length > 0 && (
          <RowCarousel title={t("home.continueWatching")} items={continueItems.map((ci) => ci.course)} owned />
        )}

        {rails.editor_picks?.length ? (
          <RowCarousel title={t("home.editorPicks")} items={rails.editor_picks} ownedById={ownedById} onInfo={openInfoIfNotOwned} />
        ) : null}

        {rails.packs?.length ? (
          <RowCarousel title={t("home.packs")} items={rails.packs} ownedById={ownedById} onInfo={openInfoIfNotOwned} />
        ) : null}

        {rails.bestsellers?.length ? (
          <RowCarousel title={t("home.bestsellers")} items={rails.bestsellers} ownedById={ownedById} onInfo={openInfoIfNotOwned} />
        ) : null}

        <RowCarousel title={t("home.trending")} items={courses} ownedById={ownedById} onInfo={openInfoIfNotOwned} />
        <RowCarousel title={t("home.new")} items={[...courses].reverse()} ownedById={ownedById} onInfo={openInfoIfNotOwned} />
      </div>

      {modalCourseId !== null && <CourseModal courseId={modalCourseId} onClose={() => setModalCourseId(null)} />}

      {/* Tabbar mobile */}
      <MobileTabbar />
    </div>
  );
}