'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, LoaderCircle, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { display } from '@/lib/market';
import { useMarket } from './market-provider';

export function MarketNav() {
  const path = usePathname();
  return (
    <header className="mp-header">
      <div className="mp-nav">
        <Link className="wordmark" href="/" aria-label="Placed home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          placed
        </Link>
        <nav aria-label="Marketplace navigation">
          <Link
            className={path === '/explore' || path.startsWith('/assets/') ? 'active' : ''}
            href="/explore"
          >
            Explore
          </Link>
          <Link className={path === '/studio' ? 'active' : ''} href="/studio">
            Studio
          </Link>
          <Link className={path === '/portfolio' ? 'active' : ''} href="/portfolio">
            Portfolio
          </Link>
        </nav>
        <MarketWalletButton />
      </div>
    </header>
  );
}
export function MarketWalletButton() {
  const { state, wallet, busy } = useMarket();
  const active = state?.people.find((p) => p.id === state.current);
  return (
    <button className="mp-button wallet" onClick={wallet} disabled={busy}>
      <Wallet size={17} />
      <span>
        {busy
          ? active
            ? 'Wallet busy…'
            : 'Connecting…'
          : active
            ? active.address
              ? `${active.address.slice(0, 6)}…${active.address.slice(-4)}`
              : active.name
            : 'Connect wallet'}
      </span>
    </button>
  );
}
export function MarketShell({ children }: { children: ReactNode }) {
  const { state, status, refresh } = useMarket();
  const active = state?.people.find((p) => p.id === state.current);
  return (
    <div className="mp-app">
      <MarketNav />
      <main className="mp-main">
        {state && status === 'error' && (
          <div className="mp-service-error" role="alert">
            <span>Could not update the marketplace. Transactions are paused.</span>
            <button className="mp-button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        )}
        {children}
      </main>
      <footer className="mp-footer">
        <span>Placed</span>
        {active?.role === 'admin' && <Link href="/admin">Review campaigns</Link>}
      </footer>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mp-page-title">
      <div>
        {eyebrow && <span className="mp-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
export function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mp-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`mp-badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  text,
  href,
  action,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mp-empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <Link className="mp-button primary" href={href}>
          {action ?? 'Browse ad spaces'}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function MarketUnavailable() {
  const { status, refresh } = useMarket();
  return (
    <MarketShell>
      {status === 'loading' ? (
        <div className="mp-empty" role="status">
          <LoaderCircle className="spin" size={24} />
          <p>Loading…</p>
        </div>
      ) : (
        <div className="mp-empty" role="status">
          <h1>Marketplace unavailable</h1>
          <p>We couldn’t load the marketplace. Please try again later.</p>
          <div className="mp-actions">
            <button className="mp-button primary" onClick={() => void refresh()}>
              Try again
            </button>
            <Link className="mp-button" href="/studio">
              Open Studio
            </Link>
          </div>
        </div>
      )}
    </MarketShell>
  );
}
export function Loading() {
  return (
    <MarketShell>
      <div className="mp-empty" role="status">
        <LoaderCircle className="spin" size={24} />
        <p>Loading…</p>
      </div>
    </MarketShell>
  );
}
export function AccessButton({
  children,
  onClick,
  verified = false,
  disabled = false,
  className = 'mp-button primary full',
}: {
  children: ReactNode;
  onClick: () => void;
  verified?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { state, ensureAccess, busy, status } = useMarket();
  const user = state?.people.find((p) => p.id === state.current);
  return (
    <button
      className={className}
      disabled={busy || status !== 'ready' || (!!user && disabled)}
      onClick={async () => {
        if (await ensureAccess(verified)) {
          if (!disabled) onClick();
        }
      }}
    >
      {!user
        ? 'Connect wallet'
        : state?.network !== 'supported'
          ? 'Switch network'
          : verified && !user.verified
            ? 'Verify identity'
            : children}
    </button>
  );
}
export function SpendButton({
  amount,
  scope,
  children,
  onReady,
  verified = false,
  disabled = false,
}: {
  amount: number;
  scope: string;
  children: ReactNode;
  onReady: () => void;
  verified?: boolean;
  disabled?: boolean;
}) {
  const { state, transact } = useMarket();
  const user = state?.people.find((p) => p.id === state.current),
    approved = (user?.approvals[scope] ?? 0) >= amount;
  return (
    <AccessButton
      verified={verified}
      disabled={disabled}
      onClick={() =>
        approved
          ? onReady()
          : transact(
              'Approve USDC',
              `Allow this action to spend up to ${display(amount, 6)} USDC. Then review your transaction. Approval does not transfer funds.`,
              { type: 'approve', scope, amount },
              onReady,
            )
      }
    >
      {approved ? children : `Approve ${display(amount, 6)} USDC`}
    </AccessButton>
  );
}
