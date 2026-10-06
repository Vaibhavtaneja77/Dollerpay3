"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AutoLoadMore({ href }: { href: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoading(true);
        router.replace(href, { scroll: false });
      },
      { rootMargin: "320px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [href, loading, router]);

  return (
    <div ref={ref} className="grid place-items-center py-5 text-sm font-medium text-zinc-500">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading more
      </span>
    </div>
  );
}
