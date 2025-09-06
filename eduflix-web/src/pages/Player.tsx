import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import client from "../api/client";
import type {CourseDetail, Lesson} from "../api/types";
import Navbar from "../components/Navbar";

export default function Player() {
  const { id } = useParams(); // course id
  const [course, setCourse] = useState<CourseDetail>();
  const [current, setCurrent] = useState<Lesson | null>(null);

  useEffect(() => {
    client.get(`/catalog/courses/${id}/`).then(res => {
      setCourse(res.data);
      setCurrent(res.data.lessons[0] ?? null);
    });
  }, [id]);

  if (!course || !current) return null;

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      <div className="grid md:grid-cols-[2fr,1fr] gap-6 max-w-7xl mx-auto px-4 py-6">
        <div>
          <video src={current.video_src} controls autoPlay className="w-full rounded-xl" />
        </div>
        <div>
          <h2 className="font-semibold mb-3">{course.title}</h2>
          <div className="space-y-2">
            {course.lessons.map(l => (
              <button key={l.id}
                onClick={()=>setCurrent(l)}
                className={`w-full text-left px-3 py-2 rounded ${current.id===l.id? "bg-white/20":"bg-white/10 hover:bg-white/20"}`}>
                {l.order}. {l.title}
              </button>
            ))}
          </div>
          <div className="mt-6">
            <div className="font-semibold">Documents</div>
            <ul className="text-sm opacity-90 mt-2 space-y-1">
              {course.documents.map(d => (
                <li key={d.id}><a href={d.file} target="_blank" className="underline">• {d.title}</a></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}