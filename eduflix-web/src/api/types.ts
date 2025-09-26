// src/api/types.ts

export type CourseLite = {
  id: number;
  title: string;
  slug: string;

  // Souvent présent, mais pas toujours → optionnel
  synopsis?: string;

  thumbnail: string;

  // Teaser (certaines API n’envoient pas toujours la même clé)
  trailer_src?: string;
  trailer_url?: string;
  trailer_file?: string;

  price_cents: number;
  currency?: string;

  categories?: string[];

  // Certaines listes renvoient déjà une bannière
  hero_banner?: string;
};

export type Lesson = {
  id: number;
  title: string;
  order: number;
  duration_seconds: number;
  is_free_preview?: boolean;
  video_src?: string;
};

export type Doc = {
  id: number;
  title: string;
  file: string;
};

export type CourseDetail = CourseLite & {
  description?: string;

  // Si non présent dans CourseLite côté liste, on le garde ici aussi
  hero_banner?: string;

  // Date d’ajout (utilisée dans le modal)
  created_at?: string;

  lessons: Lesson[];
  documents: Doc[];
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