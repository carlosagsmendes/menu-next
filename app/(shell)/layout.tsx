import { Suspense } from "react";

import { PerfBenchmarkWebVitals } from "@/components/PerfBenchmarkWebVitals";
import { SideNav } from "@/components/SideNav";
import { Toolbar } from "@/components/Toolbar";

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={null}>
      <PerfBenchmarkWebVitals />
      <Toolbar />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SideNav />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </Suspense>
  );
}
