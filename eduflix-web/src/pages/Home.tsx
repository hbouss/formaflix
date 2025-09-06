import { useEffect, useState } from "react";
import client from "../api/client";
import type {CourseLite} from "../api/types";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import RowCarousel from "../components/RowCarousel";
import { useAuth } from "../store/auth";

export default function Home() {
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    client.get("/catalog/courses/").then(res => setCourses(res.data));
  }, []);

  const featured = courses[0];

  const buyFeatured = async () => {
    if (!featured) return;
    if (!token) { alert("Connecte-toi pour acheter"); return; }
    const { data } = await client.post("/payments/create-checkout-session/", { course_id: featured.id });
    window.location.href = data.checkout_url;
  };

  return (
  <div className="bg-[#141414] min-h-screen">
    <Navbar />
    <Hero course={featured} onBuy={buyFeatured} />
    <div className="max-w-[1500px] mx-auto">
      <RowCarousel title="Tendances" items={courses} />
      <RowCarousel title="Nouveautés" items={[...courses].reverse()} />
    </div>
  </div>
);
}