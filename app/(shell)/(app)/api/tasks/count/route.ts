import { getPendingTaskCount } from "@/lib/tasks";

export async function GET() {
  const count = await getPendingTaskCount();
  return Response.json({ count });
}
