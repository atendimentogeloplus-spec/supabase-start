import { useEffect, useRef, useState, type ReactNode } from "react";

/** Container com barra de rolagem horizontal em cima e embaixo, sincronizadas. */
export function TopScroll({ className, children }: { className?: string; children: ReactNode }) {
  const top = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const update = () => setWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  });

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };

  return (
    <div>
      <div ref={top} className="overflow-x-auto" onScroll={() => sync(top.current, main.current)}>
        <div style={{ width, height: 1 }} />
      </div>
      <div ref={main} className={className} onScroll={() => sync(main.current, top.current)}>
        {children}
      </div>
    </div>
  );
}
