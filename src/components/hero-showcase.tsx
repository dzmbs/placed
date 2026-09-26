'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { heroSpaces } from '@/lib/hero-spaces';

const Scene = dynamic(() => import('./hero-showcase-scene'), {
  ssr: false,
  loading: () => <ShirtPreview />,
});

function ShirtPreview() {
  return (
    <svg className="why-showcase-fallback" viewBox="0 0 480 430" fill="none" aria-hidden="true">
      <path
        d="M179 66 102 110 48 215l69 36 34-58-17 191h213l-18-191 34 58 70-36-56-105-77-44q-60 52-121 0Z"
        fill="#b9c6a1"
        stroke="#8fa178"
        strokeWidth="2"
      />
      <path d="M179 66q60 89 121 0" stroke="#7c9167" strokeWidth="8" />
      <rect x="183" y="187" width="116" height="87" rx="4" fill="#d7f76a" />
      <path d="M229 230h24m-12-12v24" stroke="#37502b" strokeWidth="2" />
    </svg>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? <ShirtPreview /> : this.props.children;
  }
}

export default function HeroShowcase() {
  const [index, setIndex] = useState(0);
  const [slide, setSlide] = useState<{ current: number; previous: number | null }>({
    current: 0,
    previous: null,
  });
  const [sceneReady, setSceneReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const playing = !reducedMotion && visible && pageVisible && !failed;
  const modelReady = useCallback((next: number) => {
    setSceneReady(true);
    setSlide((current) =>
      current.current === next ? current : { current: next, previous: current.current },
    );
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    motion();
    visibility();
    media.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || !sceneReady || index !== slide.current) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % heroSpaces.length),
      4200,
    );
    return () => window.clearTimeout(timer);
  }, [playing, sceneReady, index, slide.current]);

  return (
    <header ref={root} className="why-hero why-hero-interactive">
      <div className="why-hero-copy">
        <h1 aria-label="Your next ad space. An outfit, a creator, a carry-on, a billboard, a bicycle, a livestream.">
          <span className="why-headline-rest" aria-hidden="true">
            Your next
            <br />
            ad space.
          </span>
          <span className="why-rotating-line" aria-hidden="true">
            <span className="why-word-transition" key={slide.current}>
              {slide.previous !== null && (
                <span className="why-word-out">{heroSpaces[slide.previous].phrase}</span>
              )}
              <span className={slide.previous === null ? 'why-word-current' : 'why-word-in'}>
                {heroSpaces[slide.current].phrase}
              </span>
            </span>
          </span>
        </h1>
        <p>Put brands where people already look.</p>
        <div className="why-hero-cta">
          <Link className="why-button" href="/explore">
            Find ad space <ArrowRight size={18} />
          </Link>
          <Link className="why-secondary-link" href="/studio">
            List your space <ArrowUpRight size={17} />
          </Link>
        </div>
        <a className="why-hero-footnote" href="#how-it-works">
          Pick a placement. Place a bid. Get placed. <ArrowDown />
        </a>
      </div>
      <div className="why-showcase">
        <div
          className="why-showcase-stage"
          data-step={slide.current % 2}
          role="img"
          aria-label={`${heroSpaces[slide.current].label} with an example ad placement`}
        >
          <SceneBoundary
            onFailure={() => {
              setFailed(true);
              setSlide({ current: 0, previous: null });
            }}
          >
            <Scene
              index={index}
              playing={playing}
              reducedMotion={reducedMotion}
              onReady={modelReady}
            />
          </SceneBoundary>
        </div>
        <Link className="why-showcase-link" href="/studio">
          Make it your ad space <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
