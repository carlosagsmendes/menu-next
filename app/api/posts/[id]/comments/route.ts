import { NextResponse } from "next/server";
import { getCommentsServer, createCommentServer } from "@/lib/posts";
import type { CommentSort, NewCommentInput } from "@/data/dto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") === "oldest" ? "oldest" : "newest" satisfies CommentSort;

  const comments = await getCommentsServer(id, sort);
  return NextResponse.json(comments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const input = (await request.json()) as NewCommentInput;

  const comment = await createCommentServer(id, input);
  return NextResponse.json(comment, { status: 201 });
}
