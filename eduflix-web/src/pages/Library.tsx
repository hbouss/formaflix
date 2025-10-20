import { useEffect, useState } from "react";
import client from "../api/client";
import type { LibraryItem } from "../api/types";
import Navbar from "../components/Navbar";
import RowCarousel from "../components/RowCarousel";
import { useTranslation } from "react-i18next";
import MobileTabbar from "../components/MobileTabbar";

export default function Library() {
  const { t } = useTranslation();
  const [items, setItems] = useState<LibraryItem[]>([]);

  useEffect(() => {
    client.get("/learning/my-library/").then((r) => setItems(r.data));
  }, []);

  return (
    <div
      className="bg-black min-h-screen text-white"
      style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Navbar />
      {/* décalage sous navbar fixe */}
      <main className="max-w-[1500px] mx-auto px-6 pt-[96px] md:pt-[104px]">
        <RowCarousel title={t("nav.library")} items={items.map((i) => i.course)} owned />

        {items.length === 0 && (
          <p className="mt-6 opacity-80">
            {t("library.empty", { defaultValue: "Aucun cours dans votre bibliothèque pour le moment." })}
          </p>
        )}
      </main>

      <MobileTabbar />
    </div>
  );
}