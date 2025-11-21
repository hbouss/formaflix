// src/api/types.ts

export type CourseLite = {
  id: number;
  title: string;
  slug: string;
  synopsis?: string;
  thumbnail: string;
  trailer_src?: string;
  trailer_url?: string;
  trailer_file?: string;
  price_cents: number;
  currency?: string;
  categories?: string[];
  hero_banner?: string;
};

export type Lesson = {
  id: number;
  title: number;
  order: number;
  duration_seconds: number;
  is_free_preview?: boolean;
  video_src?: string;
};

// ⬇️ remplace l’ancien Doc
export type CourseDocument = {
  id: number;
  title: string;
  file: string;
  open_url: string;   // ← au lieu de "file"
};

export type CourseDetail = CourseLite & {
  description?: string;
  hero_banner?: string;
  created_at?: string;
  lessons: Lesson[];
  documents: CourseDocument[]; // ← utilise le nouveau type
};

export type LibraryItem = {
  id: number;
  purchased_at: string;
  course: CourseLite;
};

export type ContinueItem = {
  course: CourseLite;
  percent: number;
  resume_lesson_id: number | null;
  resume_position_seconds: number;
};

export type FavoriteItem = {
  id: number;
  course: CourseLite;
  created_at: string;
};

export type HomeRails = {
  editor_picks: CourseLite[];
  top10: CourseLite[];
  packs: CourseLite[];
  bestsellers: CourseLite[];
};