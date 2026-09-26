'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, BarChart3, Layers3, Pause, Play } from 'lucide-react';
import { heroSpaces, type ProjectPlacement } from '@/lib/hero-spaces';

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const annotationNodes = useRef<
    Record<
      string,
      {
        box?: SVGPolygonElement | null;
        line?: SVGPolylineElement | null;
      }
    >
  >({});
  const projectPlacement = useCallback<ProjectPlacement>((modelIndex, id, corners) => {
    const nodes = annotationNodes.current[`${modelIndex}-${id}`];
    if (!nodes) return;
    nodes.box?.setAttribute('points', corners.map((point) => point.join(',')).join(' '));
    const placement = heroSpaces[modelIndex].placements.find((item) => item.id === id)!;
    const x = corners.reduce((sum, point) => sum + point[0], 0) / corners.length;
    const y = corners.reduce((sum, point) => sum + point[1], 0) / corners.length;
    const endX = placement.label.side === 'left' ? 20 : 80;
    nodes.line?.setAttribute('points', `${x},${y} ${endX},${placement.label.top + 8}`);
  }, []);
  const playing = !reducedMotion && visible && pageVisible && !failed && !paused;
  const modelReady = useCallback((next: number) => {
    setSceneReady(true);
    setActiveIndex(next);
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
    if (!playing || !sceneReady || index !== activeIndex) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % heroSpaces.length),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, sceneReady, index, activeIndex]);

  return (
    <header ref={root} className="why-hero why-hero-interactive">
      <div className="why-hero-copy">
        <h1 aria-label="Your space. Someone’s next ad">
          <span className="why-headline-rest" aria-hidden="true">
            Your space.
          </span>
          <span className="why-headline-accent" aria-hidden="true">
            Someone’s
            <br />
            next ad
          </span>
        </h1>
        <p>
          List your advertising space. Brands book it directly. Investors buy a share of the
          revenue.
        </p>
        <div className="why-hero-cta">
          <Link className="why-button" href="/explore">
            Find ad space <ArrowRight size={18} />
          </Link>
          <Link className="why-secondary-link" href="/studio">
            List your space <ArrowUpRight size={17} />
          </Link>
        </div>
        <nav className="why-chapters" aria-label="Page sections">
          <a href="#evidence">
            <BarChart3 size={17} /> The evidence
          </a>
          <a href="#how-it-works">
            <Layers3 size={17} /> How it works
          </a>
        </nav>
      </div>
      <div className="why-showcase">
        <div
          className="why-showcase-stage"
          data-step={activeIndex % 2}
          role="img"
          aria-label={`${heroSpaces[activeIndex].label} with illustrative ad placements: ${heroSpaces[activeIndex].placements.map((placement) => `${placement.name}, ${placement.price}, ${placement.booked ? 'demo booked' : 'demo open'}`).join('; ')}`}
        >
          <SceneBoundary
            onFailure={() => {
              setFailed(true);
              setActiveIndex(0);
            }}
          >
            <Scene
              index={index}
              playing={playing}
              reducedMotion={reducedMotion}
              onReady={modelReady}
              onProject={projectPlacement}
            />
          </SceneBoundary>
          {!failed && sceneReady && (
            <div className="why-placement-overlay" key={activeIndex} aria-hidden="true">
              <svg className="why-placement-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
                {heroSpaces[activeIndex].placements.map((placement) => {
                  const key = `${activeIndex}-${placement.id}`;
                  return (
                    <g className={placement.booked ? 'is-booked' : 'is-open'} key={placement.id}>
                      <polygon
                        ref={(node) => {
                          (annotationNodes.current[key] ??= {}).box = node;
                        }}
                      />
                      <polyline
                        ref={(node) => {
                          (annotationNodes.current[key] ??= {}).line = node;
                        }}
                      />
                    </g>
                  );
                })}
              </svg>
              {heroSpaces[activeIndex].placements.map((placement) => (
                <div
                  key={placement.id}
                  className={`why-placement-card ${placement.booked ? 'is-booked' : 'is-open'}`}
                  style={{ top: `${placement.label.top}%`, [placement.label.side]: '2%' }}
                >
                  <div className="why-placement-card-heading">
                    <strong>{placement.name}</strong>
                    <span>{placement.booked ? 'Demo booked' : 'Demo open'}</span>
                  </div>
                  <div className="why-placement-card-detail">
                    <span>{placement.format}</span>
                    <b>{placement.price}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="why-showcase-controls" aria-label="Ad space examples">
          {heroSpaces.map((space, next) => (
            <button
              key={space.label}
              className="why-showcase-dot"
              aria-label={`Show ${space.label.toLowerCase()} example`}
              aria-pressed={activeIndex === next}
              disabled={failed}
              onClick={() => {
                setIndex(next);
                setPaused(true);
              }}
            >
              <span />
            </button>
          ))}
          {!reducedMotion && (
            <button
              className="why-showcase-pause"
              aria-label={paused ? 'Play model carousel' : 'Pause model carousel'}
              disabled={failed}
              onClick={() => setPaused((current) => !current)}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
          )}
        </div>
        <Link className="why-showcase-link" href="/studio">
          Make it your ad space <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
