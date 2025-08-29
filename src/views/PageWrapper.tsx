import { BackgroundBeams } from "@/components/ui/background-beams";
import type { ReactNode } from "react";

export default function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <section className="w-screen h-screen relative">
      <div className="w-screen h-screen absolute left-0 top-0 right-0 bottom-0 z-50">
        <div className="relative">{children}</div>
      </div>
      <BackgroundBeams />
    </section>
  );
}
