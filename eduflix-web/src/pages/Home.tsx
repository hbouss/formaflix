// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import type { CourseLite, ContinueItem, HomeRails } from "../api/types";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import RowCarousel from "../components/RowCarousel";
import { useAuth } from "../store/auth";
import CourseModal from "../components/CourseModal";

export default function Home() {
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [rails, setRails] = useState<Partial<HomeRails>>({});

  // ids des cours possédés
  const [ownedIds, setOwnedIds] = useState<Set<number>>(new Set());
  const ownedById = useMemo(
    () => Object.fromEntries([...ownedIds].map((id) => [id, true])) as Record<number, boolean>,
    [ownedIds]
  );

  // modal “Plus d’info”
  const [modalCourseId, setModalCourseId] = useState<number | null>(null);

  const { token } = useAuth();

  // → catalogue (pour “Tendances / Nouveautés” + Hero)
  useEffect(() => {
    client.get("/catalog/courses/").then((res) => setCourses(res.data));
  }, []);

  // → rails éditoriales (coup de cœur, top10, packs, bestsellers)
  useEffect(() => {
    client.get<HomeRails>("/catalog/home-rails/").then(({ data }) => setRails(data));
  }, []);

  // → continuer à regarder + bibliothèque (pour savoir ce qui est possédé)
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
      alert("Connecte-toi pour acheter");
      return;
    }
    const { data } = await client.post("/payments/create-checkout-session/", {
      course_id: featured.id,
    });
    window.location.href = data.checkout_url;
  };

  // n’ouvre le modal que si le cours N’EST PAS possédé
  const openInfoIfNotOwned = (c: CourseLite) => {
    if (ownedIds.has(c.id)) return; // si possédé, on laisse le card gérer ses liens (lecture/infos)
    setModalCourseId(c.id);
  };

  return (
    <div className="relative min-h-dvh bg-black text-white">
      <Navbar />
      <Hero course={featured} onBuy={buyFeatured} />

      {/* 🔥 Remontée façon Netflix (la 1ʳᵉ rangée “colle” au hero) */}
      <div className="-mt-[12vh] sm:-mt-[12vh] md:-mt-[10vh] lg:-mt-[13vh] space-y-8 md:space-y-10">
        {/* 1) Top 10 — toujours en premier */}
        {rails.top10?.length ? (
          <RowCarousel
            title="Top 10 des formations aujourd'hui"
            items={rails.top10}
            ranked
            ownedById={ownedById}
            onInfo={openInfoIfNotOwned}
          />
        ) : null}

        {/* 2) Continuer à regarder */}
        {continueItems.length > 0 && (
          <RowCarousel
            title="Continuer à regarder"
            items={continueItems.map((ci) => ci.course)}
            owned
          />
        )}

        {/* 3) Le reste des rails éditoriales */}
        {rails.editor_picks?.length ? (
          <RowCarousel
            title="Trouvez votre prochain coup de cœur"
            items={rails.editor_picks}
            ownedById={ownedById}
            onInfo={openInfoIfNotOwned}
          />
        ) : null}

        {rails.packs?.length ? (
          <RowCarousel
            title="Packs complets"
            items={rails.packs}
            ownedById={ownedById}
            onInfo={openInfoIfNotOwned}
          />
        ) : null}

        {rails.bestsellers?.length ? (
          <RowCarousel
            title="Les plus vendues"
            items={rails.bestsellers}
            ownedById={ownedById}
            onInfo={openInfoIfNotOwned}
          />
        ) : null}

        {/* 4) Catalogues génériques */}
        <RowCarousel
          title="Tendances"
          items={courses}
          ownedById={ownedById}
          onInfo={openInfoIfNotOwned}
        />
        <RowCarousel
          title="Nouveautés"
          items={[...courses].reverse()}
          ownedById={ownedById}
          onInfo={openInfoIfNotOwned}
        />
      </div>

      {modalCourseId !== null && (
        <CourseModal courseId={modalCourseId} onClose={() => setModalCourseId(null)} />
      )}
    </div>
  );
}