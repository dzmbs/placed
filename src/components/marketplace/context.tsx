'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { IDKitRequestWidget, proofOfHuman, type IDKitRequestConfig } from '@worldcoin/idkit';
import type { Address } from 'viem';
import type { WalletConnection } from './providers';
import * as client from '@/lib/marketplace/client';
import type { ParticipantAuthorization } from '@/lib/marketplace/domain';
import { friendlyMarketError } from '@/lib/marketplace/progress';
import styles from './marketplace.module.css';
import BrandMark from '../brand-mark';

interface WalletState {
  usdc: string;
  credit: string;
  authorized: boolean;
  admin: boolean;
}
interface Context {
  wallet?: Address;
  session?: client.WalletSession;
  balances?: WalletState;
  worldVerified: boolean;
  busy: boolean;
  revision: number;
  run: <T>(
    label: string,
    action: () => Promise<T>,
    completionNotice?: boolean,
  ) => Promise<T | undefined>;
  authenticate: () => Promise<client.WalletSession>;
  verify: () => Promise<void>;
  refresh: () => Promise<void>;
}
const MarketplaceContext = createContext<Context | null>(null);
export function useMarketplace() {
  const value = useContext(MarketplaceContext);
  if (!value) throw new Error('Marketplace context is missing.');
  return value;
}
export function MarketplaceProvider({
  children,
  connection,
  walletControl,
  headless = false,
}: {
  children: ReactNode;
  connection?: WalletConnection;
  walletControl: ReactNode;
  headless?: boolean;
}) {
  const wallet = connection?.wallet;
  const [session, setSession] = useState<client.WalletSession>();
  const [walletState, setWalletState] = useState<{ wallet: Address; balances: WalletState }>();
  const balances =
    walletState?.wallet.toLowerCase() === wallet?.toLowerCase() ? walletState?.balances : undefined;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('Ethereum Sepolia. Demo USDC has no monetary value.');
  const [transaction, setTransaction] = useState<string>();
  const [world, setWorld] = useState<IDKitRequestConfig & { signal: string }>();
  const [worldOpen, setWorldOpen] = useState(false);
  const [worldVerified, setWorldVerified] = useState(false);
  const worldError = useRef<string>('');
  const worldAccepted = useRef(false);
  // Set after an attempt that may have produced a proof; the next request must
  // carry a new nonce or World answers duplicate_nonce.
  const worldNeedsFresh = useRef(false);
  const authorization = useRef<ParticipantAuthorization | undefined>(undefined);
  const verification = useRef<{ resolve: () => void; reject: (error: Error) => void } | undefined>(
    undefined,
  );
  async function refresh() {
    if (wallet)
      setWalletState({ wallet, balances: await client.api<WalletState>(`/wallet/${wallet}`) });
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    client.selectWalletProvider(connection?.provider);
    setSession(undefined);
    setWalletState(undefined);
    setWorldVerified(false);
    setWorld(undefined);
    setWorldOpen(false);
    authorization.current = undefined;
    verification.current?.reject(new Error('Your wallet changed. Verify with the current wallet.'));
    verification.current = undefined;
    return () => client.selectWalletProvider(undefined);
  }, [connection]);
  useEffect(() => {
    if (!wallet || headless) return;
    let active = true,
      pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const next = await client.api<WalletState>(`/wallet/${wallet}`);
        if (active) setWalletState({ wallet, balances: next });
      } catch {
        if (active) setNotice('Could not read Sepolia balances. Retrying…');
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [wallet, revision, headless]);
  async function run<T>(
    label: string,
    action: () => Promise<T>,
    completionNotice = true,
  ): Promise<T | undefined> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setTransaction(undefined);
    setNotice(`${label}. Confirm any requested wallet action, then wait for confirmation.`);
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'transactionHash' in result)
        setTransaction(String(result.transactionHash));
      if (completionNotice) setNotice(`${label} completed.`);
      setRevision((value) => value + 1);
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.split('\n')[0]
          : 'The action could not be completed.';
      setNotice(message.slice(0, 240));
      return undefined;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function authenticate() {
    if (!wallet) throw new Error('Connect your wallet first.');
    if (session?.wallet === wallet && session.expires > Date.now() / 1000 + 30) return session;
    const next = await client.signIn(wallet);
    setSession(next);
    return next;
  }
  async function verify() {
    if (!wallet) throw new Error('Connect your wallet first.');
    const currentWallet = await client.api<WalletState>(`/wallet/${wallet}`);
    if (currentWallet.authorized) return;
    const signedSession = await authenticate();
    const status = await client.api<{ verified: boolean }>(
      '/world/authorization',
      undefined,
      signedSession,
    );
    setWorldVerified(status.verified);
    if (status.verified) {
      const voucher = await client.api<ParticipantAuthorization>(
        '/world/authorization',
        { method: 'POST' },
        signedSession,
      );
      await client.authorizeParticipant(wallet, voucher);
      setNotice('Human verification and wallet authorization completed. Publishing is ready.');
      return;
    }
    const fresh = worldNeedsFresh.current;
    const request = await client.api<IDKitRequestConfig & { signal: string }>(
      '/world/request',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fresh }),
      },
      signedSession,
    );
    worldNeedsFresh.current = false;
    console.info('[world] request', {
      wallet,
      fresh,
      nonce: request.rp_context.nonce.slice(0, 10),
      action: request.action,
      environment: request.environment,
    });
    worldAccepted.current = false;
    worldError.current = '';
    authorization.current = undefined;
    setNotice(
      'Complete the World dialog. After backend verification, confirm the wallet authorization transaction.',
    );
    setWorld(request);
    setWorldOpen(true);
    return new Promise<void>((resolve, reject) => {
      verification.current = { resolve, reject };
    });
  }
  return (
    <MarketplaceContext.Provider
      value={{
        wallet,
        session,
        balances,
        worldVerified,
        busy,
        revision,
        run,
        authenticate,
        verify,
        refresh,
      }}
    >
      <div className={headless ? undefined : styles.shell}>
        {!headless && (
          <>
            <header className={styles.header}>
              <Link className={styles.wordmark} href="/marketplace">
                <BrandMark />
                placed<span> / Sepolia</span>
              </Link>
              <nav>
                <Link href="/marketplace">Explore</Link>
                <Link href="/marketplace/create">List an asset</Link>
                <Link href="/marketplace/holdings">Holdings</Link>
                <Link href="/studio">3D studio</Link>
                {balances?.admin && <Link href="/marketplace/admin">Admin</Link>}
              </nav>
              {walletControl}
            </header>
            <div className={styles.status} role="status" aria-live="polite">
              <span>
                {busy && '◌ '}
                {notice}
              </span>
              {transaction && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${transaction}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction ↗
                </a>
              )}
            </div>
            {wallet && (
              <div className={styles.walletBar}>
                <span>
                  {balances
                    ? `${Number(BigInt(balances.usdc)) / 1e6} demo USDC`
                    : 'Reading balance…'}
                </span>
                <button
                  disabled={busy}
                  onClick={() => void run('Get demo USDC', () => client.faucet(wallet))}
                >
                  Get demo USDC
                </button>
                <button
                  disabled={busy || balances?.authorized}
                  onClick={() => void run('Verify participant', verify, false)}
                >
                  {balances?.authorized
                    ? 'Human verified'
                    : worldVerified
                      ? 'Finish wallet authorization'
                      : 'Verify with World'}
                </button>
                {balances && BigInt(balances.credit) > 0n && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run('Withdraw outbid funds', () => client.withdrawOutbid(wallet))
                    }
                  >
                    Withdraw {Number(BigInt(balances.credit)) / 1e6} USDC
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {headless ? children : <main className={styles.main}>{children}</main>}
        {world && (
          <IDKitRequestWidget
            key={world.rp_context.nonce}
            {...world}
            preset={proofOfHuman({ signal: world.signal })}
            open={worldOpen}
            onOpenChange={(open) => {
              setWorldOpen(open);
              if (!open && !worldAccepted.current && !worldError.current)
                setNotice('Verification cancelled. Publishing and bidding remain unavailable.');
              if (!open && !worldAccepted.current) {
                verification.current?.reject(
                  new Error(
                    worldError.current ||
                      'Verification cancelled. No protected action was completed.',
                  ),
                );
                verification.current = undefined;
              }
            }}
            handleVerify={async (result) => {
              const credential = result.responses?.[0] as
                | { identifier?: string; nullifier?: string }
                | undefined;
              console.info('[world] proof from World', {
                protocol: result.protocol_version,
                environment: result.environment,
                credential: credential?.identifier,
                nullifier: credential?.nullifier?.slice(0, 12),
              });
              try {
                const current = await authenticate();
                authorization.current = await client.api<ParticipantAuthorization>(
                  '/world/verify',
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ result }),
                  },
                  current,
                );
                worldAccepted.current = true;
                setWorldVerified(true);
                setNotice(
                  'World proof verified. Confirm the Sepolia wallet authorization transaction.',
                );
              } catch (error) {
                worldNeedsFresh.current = true;
                console.warn('[world] backend rejected proof', error);
                worldError.current = friendlyMarketError(error);
                setNotice(worldError.current);
                setWorldOpen(false);
                verification.current?.reject(new Error(worldError.current));
                verification.current = undefined;
                throw error;
              }
            }}
            onSuccess={async () => {
              try {
                if (!wallet || !authorization.current)
                  throw new Error('Verification authorization is missing.');
                await client.authorizeParticipant(wallet, authorization.current);
                await refresh();
                verification.current?.resolve();
              } catch (error) {
                verification.current?.reject(
                  error instanceof Error ? error : new Error('Wallet authorization failed.'),
                );
              } finally {
                verification.current = undefined;
              }
            }}
            onError={(code, debugReport) => {
              console.warn('[world] widget error', code, debugReport);
              if (code !== 'user_rejected' && code !== 'cancelled') worldNeedsFresh.current = true;
              worldError.current ||= worldErrorMessage(code);
              setNotice(worldError.current);
              setWorldOpen(false);
              verification.current?.reject(new Error(worldError.current));
              verification.current = undefined;
            }}
          />
        )}
      </div>
    </MarketplaceContext.Provider>
  );
}

function worldErrorMessage(code: string) {
  switch (code) {
    case 'user_rejected':
    case 'verification_rejected':
    case 'cancelled':
      return 'You cancelled World verification. No protected action was completed.';
    case 'nullifier_replayed':
    case 'max_verifications_reached':
      return 'This World identity has already verified for this app. Use the wallet it verified, or pick a different identity in the World simulator.';
    case 'inclusion_proof_pending':
      return 'This World identity is not ready yet. Wait a few minutes, then try again.';
    case 'duplicate_nonce':
    case 'rp_signature_expired':
    case 'timestamp_too_old':
      return 'The World request expired or was already used. Try again to get a new one.';
    case 'invalid_network':
      return 'World app and this site use different environments. Use the World simulator for staging.';
    case 'credential_unavailable':
    case 'world_id_4_not_available':
    case 'world_id_3_not_available':
      return 'This World identity has no Proof of Human credential. Pick a verified identity.';
    default:
      return `World verification could not be completed (${code}). Try again, and check the browser console for details.`;
  }
}
