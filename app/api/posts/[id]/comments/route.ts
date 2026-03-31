import { NextResponse } from "next/server";
import { getCommentsServer, createCommentServer } from "@/lib/posts";
import { startBenchmarkRequest } from "@/lib/perf/request-metrics";
import type { CommentSort, NewCommentInput } from "@/data/dto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const benchmarkRequest = startBenchmarkRequest({
    routeLabel: "/api/posts/[id]/comments",
    phase: "api",
  });
  const { id } = await params;
  benchmarkRequest.update({ entityId: id });
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") === "oldest" ? "oldest" : "newest" satisfies CommentSort;

  const comments = await getCommentsServer(id, sort);
  benchmarkRequest.update({
    status: 200,
    extra: {
      method: "GET",
      sort,
    },
  });
  return NextResponse.json(comments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const benchmarkRequest = startBenchmarkRequest({
    routeLabel: "/api/posts/[id]/comments",
    phase: "api",
  });
  const { id } = await params;
  benchmarkRequest.update({ entityId: id });
  const input = (await request.json()) as NewCommentInput;

  const comment = await createCommentServer(id, input);
  benchmarkRequest.update({
    status: 201,
    extra: {
      method: "POST",
    },
  });
  return NextResponse.json(comment, { status: 201 });
}
