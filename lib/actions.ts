"use server";

import { getPostsPage, type PostsPage } from "@/lib/posts";

export async function fetchPostsPageAction(cursor: number): Promise<PostsPage> {
  return getPostsPage(cursor);
}
