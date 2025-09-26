// src/pages/Library.tsx
import { useEffect, useState } from "react";
import client from "../api/client";
import type { LibraryItem } from "../api/types";
import Navbar from "../components/Navbar";
import RowCarousel from "../components/RowCarousel";
import { useTranslation } from "react-i18next";

export default function Library() {
  const { t } = useTranslation();
  const [items, setItems] = useState<LibraryItem[]>([]);
  useEffect(() => { client.get("/learning/my-library/").then(r => setItems(r.data)); }, []);
  return (
    <div className="bg-black min-h-screen">
      <Navbar />
      <RowCarousel title={t("nav.library")} items={items.map(i => i.course)} owned />
    </div>
  );
}