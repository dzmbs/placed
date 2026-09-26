'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export function EvidenceCarousel({ children, count }: { children: ReactNode; count: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      setEdges({
        start: element.scrollLeft <= 2,
        end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
      });
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  function move(direction: number) {
    const element = track.current;
    const card = element?.firstElementChild;
    if (!element || !card) return;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  return (
    <div
      className="why-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured campaign evidence"
    >
      <div className="why-carousel-toolbar">
        <span>{count} featured campaigns</span>
        <div className="why-carousel-controls">
          <button
            type="button"
            aria-label="Previous evidence"
            aria-controls="featured-evidence"
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            type="button"
            aria-label="Next evidence"
            aria-controls="featured-evidence"
            disabled={edges.end}
            onClick={() => move(1)}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <div
        ref={track}
        id="featured-evidence"
        className="why-evidence-grid"
        tabIndex={0}
        aria-label="Scroll through campaign evidence"
      >
        {children}
      </div>
    </div>
  );
}
