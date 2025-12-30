import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import type { CourseLite, ContinueItem, HomeRails } from "../api/types";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import RowCarousel from "../components/RowCarousel";
import { useAuth } from "../store/auth";
import CourseModal from "../components/CourseModal";
import MobileTabbar from "../components/MobileTabbar";
type LibraryEntry = {
  course: {
    id: number;
  };
};
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
    .get<LibraryEntry[]>("/learning/my-library/")
    .then((r) => {
      const s = new Set<number>(r.data.map((e) => e.course.id));
      setOwnedIds(s);
    })
    .catch(() => setOwnedIds(new Set()));
  }, [token]);

  const featured = courses[0];
  const featuredOwned = featured ? ownedIds.has(featured.id) : false; // ✅
  // helper viewport
  const isMobile = () =>
    window.matchMedia("(max-width: 767px)").matches || /Mobi|Android/i.test(navigator.userAgent);

  const buyFeatured = async () => {
    if (!featured) return;
    if (!token) {
      alert(t("alerts.loginToBuy"));
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: featured.id });
    window.location.href = data.checkout_url;
  };

  const playFeatured = () => {             // ✅ Lecture pour le Hero si acheté
    if (!featured) return;
    nav(`/player/${featured.id}`);
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

  const openHeroInfo = () => {
    if (!featured) return;
    if (isMobile()) {
      nav(`/info/${featured.id}`);     // ✅ page mobile
    } else {
      setModalCourseId(featured.id);   // ✅ modal desktop
    }
  };

  const buyCourse = async (courseId: number) => {
  if (!token) {
    alert(t("alerts.loginToBuy"));
    return;
  }
  const { data } = await client.post("/payments/create-checkout-session/", { course_id: courseId });
  window.location.href = data.checkout_url;
};

  return (
        <div
      className="relative min-h-dvh bg-black text-white"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Helmet>
        <title>Formations esthétiques en ligne | SBeautyflix</title>
        <meta
          name="description"
          content="Formations beauté en ligne : microblading, extensions de cils, hydrafacial, dermaplaning, BB Glow… Accès illimité à tes masterclass esthétiques avec SBeautyflix."
        />
      </Helmet>
      <Navbar />

      <Hero
        course={featured}
        owned={featuredOwned}        // ✅ passe l’état d’achat
        onBuy={buyFeatured}
        onPlay={playFeatured}        // ✅ callback Lecture
        onMoreInfo={openHeroInfo}
      />

      <div className="-mt-[12vh] sm:-mt-[12vh] md:-mt-[10vh] lg:-mt-[13vh] space-y-8 md:space-y-10">
        {rails.top10?.length ? (
          <RowCarousel
            title={t("home.top10Today")}
            items={rails.top10}
            ranked
            ownedById={ownedById}
            onInfo={openInfoIfNotOwned}
            onBuy={(c) => buyCourse(c.id)}
          />
        ) : null}

        {continueItems.length > 0 && (
          <RowCarousel title={t("home.continueWatching")} items={continueItems.map((ci) => ci.course)} owned />
        )}

        {rails.editor_picks?.length ? (
          <RowCarousel title={t("home.editorPicks")} items={rails.editor_picks} ownedById={ownedById} onInfo={openInfoIfNotOwned} onBuy={(c)=>buyCourse(c.id)}  />
        ) : null}

        {rails.packs?.length ? (
          <RowCarousel title={t("home.packs")} items={rails.packs} ownedById={ownedById} onInfo={openInfoIfNotOwned} onBuy={(c)=>buyCourse(c.id)} />
        ) : null}

        {rails.bestsellers?.length ? (
          <RowCarousel title={t("home.bestsellers")} items={rails.bestsellers} ownedById={ownedById} onInfo={openInfoIfNotOwned} onBuy={(c)=>buyCourse(c.id)} />
        ) : null}

        <RowCarousel title={t("home.trending")} items={courses} ownedById={ownedById} onInfo={openInfoIfNotOwned} onBuy={(c)=>buyCourse(c.id)} />
        <RowCarousel title={t("home.new")} items={[...courses].reverse()} ownedById={ownedById} onInfo={openInfoIfNotOwned} onBuy={(c)=>buyCourse(c.id)} />
      </div>

      {modalCourseId !== null && <CourseModal courseId={modalCourseId} onClose={() => setModalCourseId(null)} />}


            {/* Bloc texte SEO sous les carrousels */}
      <section className="max-w-4xl mx-auto px-4 pb-12 mt-10 text-sm md:text-base text-neutral-200 space-y-3">
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
          Formations esthétiques en ligne & masterclass beauté
        </h1>
        <p>
          SBeautyflix est la plateforme de formations esthétiques en ligne pensée pour les
          professionnelles de la beauté : microblading, extensions de cils, hydrafacial, dermaplaning,
          BB Glow, browlift, microneedling et bien plus. Tu apprends à ton rythme, depuis chez toi,
          avec des masterclass filmées en haute qualité.
        </p>
        <p>
          Chaque formation esthétique en ligne inclut un accès illimité aux vidéos, des livrets PDF
          détaillés, des protocoles, et un certificat SBeauty Academy. Que tu démarres dans le métier
          ou que tu veuilles te perfectionner, tu trouves sur SBeautyflix des contenus concrets et
          directement applicables en institut.
        </p>
      </section>

      <MobileTabbar />
    </div>
  );
}