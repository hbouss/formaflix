// src/pages/MyList.tsx
import { useEffect, useState } from "react";
import client from "../api/client";
import Navbar from "../components/Navbar";
import RowCarousel from "../components/RowCarousel";
import type { FavoriteItem, CourseLite } from "../api/types";
import { useTranslation } from "react-i18next";

export default function MyList() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  useEffect(() => { client.get("/learning/my-list/").then(r => setItems(r.data)).catch(()=>{}); }, []);
  const courses: CourseLite[] = items.map(i => i.course);

  return (
    <div className="bg-[#141414] min-h-screen">
      <Navbar />
      <div className="max-w-[1500px] mx-auto">
        <RowCarousel title={t("nav.myList")} items={courses} owned />
      </div>
    </div>
  );
}