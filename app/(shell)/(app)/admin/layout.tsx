import { Suspense } from "react";
import { getSession } from "@/data/auth";
import { forbidden } from "next/navigation";
import { PageLoadingFallback } from "@/components/PageLoadingFallback";

async function AuthGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) forbidden();
  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
