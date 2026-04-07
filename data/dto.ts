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

export type PostDetail = Post & {
  content: string[];
  likes: number;
};

export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type CommentSort = "newest" | "oldest";

export type NewCommentInput = {
  author: string;
  body: string;
};
