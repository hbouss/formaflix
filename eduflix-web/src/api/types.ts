export type CourseLite = {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  thumbnail: string;
  trailer_src: string;
  price_cents: number;
  currency: string;
  categories: string[];
};

export type Lesson = {
  id: number;
  title: string;
  order: number;
  duration_seconds: number;
  is_free_preview: boolean;
  video_src: string;
};

export type Doc = { id: number; title: string; file: string };

export type CourseDetail = CourseLite & {
  description: string;
  hero_banner: string;
  lessons: Lesson[];
  documents: Doc[];
};

export type LibraryItem = {
  id: number;
  purchased_at: string;
  course: CourseLite;
};