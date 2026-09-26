'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { IDKitRequestWidget, proofOfHuman, type IDKitRequestConfig } from '@worldcoin/idkit';
import type { Address, EIP1193Provider } from 'viem';
import * as client from '@/lib/marketplace/client';
import type { ParticipantAuthorization } from '@/lib/marketplace/domain';
import styles from './marketplace.module.css';

interface WalletState {
  usdc: string;
  credit: string;
  authorized: boolean;
  admin: boolean;
}
interface InjectedWallet {
  info: { uuid: string; name: string; rdns: string };
  provider: EIP1193Provider;
}
interface Context {
  wallet?: Address;
  session?: client.WalletSession;
  balances?: WalletState;
  busy: boolean;
  revision: number;
  run: <T>(label: string, action: () => Promise<T>) => Promise<T | undefined>;
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
export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Address>();
  const [session, setSession] = useState<client.WalletSession>();
  const [balances, setBalances] = useState<WalletState>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('Ethereum Sepolia. Demo USDC has no monetary value.');
  const [transaction, setTransaction] = useState<string>();
  const [world, setWorld] = useState<IDKitRequestConfig & { signal: string }>();
  const [worldOpen, setWorldOpen] = useState(false);
  const [wallets, setWallets] = useState<InjectedWallet[]>([]);
  const [walletChoice, setWalletChoice] = useState('');
  const worldAccepted = useRef(false);
  const authorization = useRef<ParticipantAuthorization | undefined>(undefined);
  async function refresh() {
    if (wallet) setBalances(await client.api<WalletState>(`/wallet/${wallet}`));
    setRevision((value) => value + 1);
  }
  useEffect(() => {
    if (wallet)
      client
        .api<WalletState>(`/wallet/${wallet}`)
        .then(setBalances)
        .catch(() => setBalances(undefined));
  }, [wallet, revision]);
  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<InjectedWallet>).detail;
      if (detail?.info?.uuid && typeof detail.provider?.request === 'function')
        setWallets((value) =>
          value.some((wallet) => wallet.info.uuid === detail.info.uuid)
            ? value
            : [...value, detail],
        );
    };
    window.addEventListener('eip6963:announceProvider', announce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', announce);
  }, []);
  useEffect(() => {
    if (wallets.length && !walletChoice)
      setWalletChoice(
        (wallets.find((wallet) => wallet.info.rdns === 'io.metamask') || wallets[0]).info.uuid,
      );
  }, [wallets, walletChoice]);
  useEffect(() => {
    const selected = wallets.find((value) => value.info.uuid === walletChoice);
    if (selected) client.selectWalletProvider(selected.provider);
    const injected = (selected?.provider ||
      (window as Window & { ethereum?: EIP1193Provider }).ethereum) as
      | (EIP1193Provider & {
          on?: (event: string, callback: () => void) => void;
          removeListener?: (event: string, callback: () => void) => void;
        })
      | undefined;
    const reset = () => {
      setWallet(undefined);
      setSession(undefined);
      setBalances(undefined);
      setWorld(undefined);
      setWorldOpen(false);
      authorization.current = undefined;
      setNotice('Wallet or network changed. Connect again.');
    };
    injected?.on?.('accountsChanged', reset);
    injected?.on?.('chainChanged', reset);
    return () => {
      injected?.removeListener?.('accountsChanged', reset);
      injected?.removeListener?.('chainChanged', reset);
    };
  }, [wallets, walletChoice]);
  async function run<T>(label: string, action: () => Promise<T>): Promise<T | undefined> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setTransaction(undefined);
    setNotice(`${label}. Confirm any requested wallet action, then wait for confirmation.`);
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'transactionHash' in result)
        setTransaction(String(result.transactionHash));
      setNotice(`${label} completed.`);
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
    const signedSession = await authenticate();
    try {
      const voucher = await client.api<ParticipantAuthorization>(
        '/world/authorization',
        { method: 'POST' },
        signedSession,
      );
      await client.authorizeParticipant(wallet, voucher);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Proof of Human')) throw error;
    }
    const request = await client.api<IDKitRequestConfig & { signal: string }>(
      '/world/request',
      { method: 'POST' },
      signedSession,
    );
    worldAccepted.current = false;
    authorization.current = undefined;
    setWorld(request);
    setWorldOpen(true);
  }
  return (
    <MarketplaceContext.Provider
      value={{ wallet, session, balances, busy, revision, run, authenticate, verify, refresh }}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.wordmark} href="/marketplace">
            placed<span> / Sepolia</span>
          </Link>
          <nav>
            <Link href="/marketplace">Explore</Link>
            <Link href="/marketplace/create">List an asset</Link>
            <Link href="/marketplace/holdings">Holdings</Link>
            <Link href="/">3D studio</Link>
            {balances?.admin && <Link href="/marketplace/admin">Admin</Link>}
          </nav>
          {wallets.length > 1 && (
            <select
              aria-label="Wallet provider"
              value={walletChoice}
              disabled={busy}
              style={{ width: 'auto' }}
              onChange={(event) => {
                setWalletChoice(event.target.value);
                setWallet(undefined);
                setSession(undefined);
                setBalances(undefined);
              }}
            >
              {wallets.map((wallet) => (
                <option value={wallet.info.uuid} key={wallet.info.uuid}>
                  {wallet.info.name}
                </option>
              ))}
            </select>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void run('Connect wallet', async () => {
                const next = await client.connectWallet();
                setWallet(next);
                return next;
              })
            }
          >
            {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Connect wallet'}
          </button>
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
              {balances ? `${Number(BigInt(balances.usdc)) / 1e6} demo USDC` : 'Reading balance…'}
            </span>
            <button
              disabled={busy}
              onClick={() => void run('Get demo USDC', () => client.faucet(wallet))}
            >
              Get demo USDC
            </button>
            <button
              disabled={busy || balances?.authorized}
              onClick={() => void run('Verify participant', verify)}
            >
              {balances?.authorized ? 'Human verified' : 'Verify with World'}
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
        <main className={styles.main}>{children}</main>
        {world && (
          <IDKitRequestWidget
            {...world}
            preset={proofOfHuman({ signal: world.signal })}
            open={worldOpen}
            onOpenChange={(open) => {
              setWorldOpen(open);
              if (!open && !worldAccepted.current)
                setNotice('Verification cancelled. Publishing and bidding remain unavailable.');
            }}
            handleVerify={async (result) => {
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
            }}
            onSuccess={async () => {
              if (wallet && authorization.current)
                await run('Authorize verified participant on Sepolia', () =>
                  client.authorizeParticipant(wallet, authorization.current!),
                );
            }}
            onError={() =>
              setNotice('World verification failed. No participant authorization was granted.')
            }
          />
        )}
      </div>
    </MarketplaceContext.Provider>
  );
}
