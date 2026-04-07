"use server";

import { revalidatePath } from "next/cache";

import { applyPostLikesDelta } from "@/lib/posts";

export async function incrementContextPostLikesAction(
  postId: string,
  delta: number,
): Promise<number> {
  if (!/^\d+$/.test(postId)) {
    throw new Error("Invalid post id");
  }

  if (!Number.isInteger(delta) || delta < 1) {
    throw new Error("Invalid likes delta");
  }

  const likes = await applyPostLikesDelta(postId, delta);
  revalidatePath(`/context/${postId}`);

  return likes;
}
