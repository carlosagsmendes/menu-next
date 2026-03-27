export type Post = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
};

export type PostsPage = {
  posts: Post[];
  nextCursor: number | null;
};

export type Task = {
  id: string;
  title: string;
  status: "pending" | "done";
};

export type SearchResult = {
  id: string;
  title: string;
  description: string;
  href: string;
};
