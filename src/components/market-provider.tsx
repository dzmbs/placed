'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  LoaderCircle,
  X,
  Wallet,
  Droplets,
  ShieldCheck,
  RefreshCw,
  LogOut,
  Copy,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { WalletPopover } from './wallet-popover';
import {
  ConfirmedActionRefreshError,
  friendlyMarketError,
  type TransactionProgress,
} from '@/lib/marketplace/progress';
import { display, type MarketAction, type MarketState } from '@/lib/market';
import {
  assertCanConfirm,
  marketClient,
  validateSwapQuote,
  type MarketClient,
  type SwapRequest,
  type SwapQuote,
} from '@/lib/market-client';

type Transaction = {
  title: string;
  description: string;
  action: MarketAction;
  user: string;
  onSuccess?: () => void;
  confirmed?: { hash?: string };
};
type Context = {
  state: MarketState | null;
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  error: string;
  busy: boolean;
  refresh: () => Promise<void>;
  transact: (
    title: string,
    description: string,
    action: MarketAction,
    onSuccess?: () => void,
  ) => void;
  wallet: () => void;
  walletOpen: boolean;
  connect: () => Promise<boolean>;
  ensureAccess: (verified: boolean) => Promise<boolean>;
  verify: () => Promise<boolean>;
  switchNetwork: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  quoteSwap: (request: SwapRequest) => Promise<SwapQuote>;
  notify: (message: string) => void;
};
const MarketContext = createContext<Context | null>(null);
export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) throw new Error('Market provider missing');
  return context;
}

export function MarketDialog({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.focus();
    const keyboard = (event: KeyboardEvent) => {
      // Only the uppermost review handles keyboard dismissal and focus.
      if (Array.from(document.querySelectorAll('.mp-dialog')).at(-1) !== node) return;
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !node?.contains(document.activeElement)) return;
      const controls = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
        ),
      );
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className="mp-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div
        ref={dialog}
        className="mp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        tabIndex={-1}
      >
        <div className="mp-dialog-inner">
          <button className="mp-close" aria-label="Close dialog" onClick={close} disabled={busy}>
            <X size={22} />
          </button>
          <h2>{title}</h2>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const unavailableMessage = 'Wallet connection is unavailable. Please try again later.';

export function MarketProvider({
  children,
  client = marketClient,
}: {
  children: ReactNode;
  client?: MarketClient | null;
}) {
  const [state, setState] = useState<MarketState | null>(null);
  const [status, setStatus] = useState<Context['status']>(client ? 'loading' : 'unavailable');
  const [error, setError] = useState('');
  const current = useRef<MarketState | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const pending = useRef(false);
  const timeOffset = useRef(0);
  const [busy, setBusy] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [txError, setTxError] = useState('');
  const [toast, setToast] = useState('');
  const [sessionBusy, setSessionBusy] = useState(false);
  const [progress, setProgress] = useState<TransactionProgress | null>(null);
  useEffect(() => {
    const changed = (event: Event) => {
      const next = (event as CustomEvent<TransactionProgress>).detail;
      setProgress((previous) =>
        next.phase === 'refreshing' && !next.hash ? { ...next, hash: previous?.hash } : next,
      );
    };
    window.addEventListener('placed-transaction', changed);
    return () => window.removeEventListener('placed-transaction', changed);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 6500);
  }, []);
  const accept = useCallback((next: MarketState) => {
    current.current = next;
    timeOffset.current = next.now - Date.now();
    setState(next);
    setStatus('ready');
    setError('');
  }, []);
  const refresh = useCallback(async () => {
    if (!client) {
      setStatus('unavailable');
      return;
    }
    if (pending.current) return;
    const request = ++generation.current;
    try {
      const next = await client.getState();
      if (mounted.current && request === generation.current) accept(next);
    } catch {
      if (mounted.current && request === generation.current) {
        setStatus('error');
        setError('Could not load the marketplace. Please try again.');
      }
    }
  }, [client, accept]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const changed = () => {
      void refresh();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') changed();
    };
    const unsubscribe = client?.subscribe?.(changed);
    window.addEventListener('focus', changed);
    document.addEventListener('visibilitychange', visible);
    const poll = client
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void refresh();
        }, 30000)
      : null;
    const clock = client
      ? setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          setState((s) => {
            if (!s) return s;
            const next = { ...s, now: Date.now() + timeOffset.current };
            current.current = next;
            return next;
          });
        }, 1000)
      : null;
    return () => {
      mounted.current = false;
      generation.current++;
      unsubscribe?.();
      window.removeEventListener('focus', changed);
      document.removeEventListener('visibilitychange', visible);
      if (poll) clearInterval(poll);
      if (clock) clearInterval(clock);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [client, refresh]);

  const session = async (method: 'connect' | 'verify' | 'switchNetwork' | 'changeWallet') => {
    if (!client) {
      setWalletError(unavailableMessage);
      setWalletOpen(true);
      return false;
    }
    if (pending.current) return false;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setSessionBusy(true);
    setProgress({
      phase: 'wallet',
      label:
        method === 'verify'
          ? 'Complete World verification, then authorize your wallet'
          : method === 'switchNetwork'
            ? 'Switch to Sepolia in your wallet'
            : 'Connect your wallet with Privy',
    });
    setWalletError('');
    setWalletOpen(false);
    try {
      const next = await client[method]();
      if (!mounted.current) return false;
      accept(next);
      const user = next.people.find((p) => p.id === next.current);
      if (!user) throw new Error('Connect your wallet to continue.');
      if (method === 'verify' && !user.verified) throw new Error('Verification was not completed.');
      if (method === 'switchNetwork' && next.network !== 'supported')
        throw new Error('Switch to the supported network in your wallet.');
      setWalletOpen(false);
      return true;
    } catch (err) {
      if (mounted.current) {
        setWalletError(friendlyMarketError(err));
        setWalletOpen(true);
      }
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setSessionBusy(false);
      }
    }
  };
  const connect = async () => (current.current?.current ? true : session('connect'));
  const ensureAccess = async (verified: boolean) => {
    if (!(await connect())) return false;
    if (current.current?.network !== 'supported' && !(await session('switchNetwork'))) return false;
    const user = current.current?.people.find((p) => p.id === current.current?.current);
    if (verified && !user?.verified && !(await session('verify'))) return false;
    return true;
  };
  const disconnect = async () => {
    if (!client || pending.current) return;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setSessionBusy(true);
    setProgress(null);
    try {
      const next = await client.disconnect();
      if (!mounted.current) return;
      accept(next);
      setWalletOpen(false);
      setTransaction(null);
    } catch {
      if (mounted.current) setWalletError('Could not disconnect. Please try again.');
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setSessionBusy(false);
      }
    }
  };
  const wallet = () => {
    setWalletError('');
    if (current.current?.current) setWalletOpen((open) => !open);
    else void session('connect');
  };
  const transact: Context['transact'] = (title, description, action, onSuccess) => {
    if (!client || status !== 'ready') {
      notify('Transactions are unavailable. Please try again later.');
      return;
    }
    if (!current.current?.current) {
      wallet();
      return;
    }
    if (pending.current) return;
    setTxError('');
    setProgress(null);
    setTransaction({ title, description, action, onSuccess, user: current.current.current });
    setWalletOpen(false);
  };
  const confirm = async () => {
    if (!transaction || !client || pending.current) return;
    const tx = transaction;
    setProgress(
      tx.confirmed
        ? {
            phase: 'refreshing',
            label: 'Refreshing balances and activity',
            hash: tx.confirmed.hash,
          }
        : { phase: 'preparing', label: `Preparing ${tx.title.toLowerCase()}` },
    );
    pending.current = true;
    generation.current++;
    setBusy(true);
    setTxError('');
    try {
      // Refresh before signing so account/network changes invalidate an old review.
      if (!tx.confirmed) {
        const latest = await client.getState();
        if (!mounted.current) return;
        accept(latest);
        assertCanConfirm(latest, tx.action, tx.user);
      }
      setTransaction(null);
      if (!tx.confirmed) notify('Continue in your wallet. Waiting for confirmation…');
      const result = await client.execute(tx.action, tx.user);
      if (!mounted.current) return;
      accept(result.state);
      setTransaction(null);
      notify(result.message || 'Transaction confirmed.');
      pending.current = false;
      setBusy(false);
      if (result.state.current === tx.user && result.state.network === 'supported')
        tx.onSuccess?.();
      else
        notify(
          'Transaction confirmed. Your wallet changed; review your account before continuing.',
        );
    } catch (err) {
      if (mounted.current) {
        const confirmed =
          err instanceof ConfirmedActionRefreshError ? { hash: err.hash } : tx.confirmed;
        setTransaction({ ...tx, confirmed });
        setTxError(
          confirmed
            ? friendlyMarketError(new ConfirmedActionRefreshError(confirmed.hash))
            : friendlyMarketError(err),
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        setSessionBusy(false);
      }
    }
  };
  const quoteSwap = useCallback(
    async (request: SwapRequest) => {
      if (!client) throw new Error('Trading is unavailable. Please try again later.');
      return validateSwapQuote(await client.quoteSwap(request), current.current?.now ?? Date.now());
    },
    [client],
  );
  const active = state?.people.find((p) => p.id === state.current);

  return (
    <MarketContext.Provider
      value={{
        state,
        status,
        error,
        busy,
        refresh,
        transact,
        wallet,
        walletOpen,
        connect,
        disconnect,
        ensureAccess,
        verify: () => session('verify'),
        switchNetwork: () => session('switchNetwork'),
        quoteSwap,
        notify,
      }}
    >
      {children}
      {walletOpen && (
        <WalletPopover close={() => setWalletOpen(false)}>
          {active && (
            <>
              <div className="mp-wallet-summary">
                <span className="mp-wallet-symbol">
                  <Wallet size={24} />
                </span>
                <div>
                  <span>DEMO USDC</span>
                  <strong>{display(active.usdc, 6)}</strong>
                </div>
                <span className="mp-badge">Sepolia</span>
              </div>
              <dl className="mp-rows">
                <div>
                  <dt>Account</dt>
                  <dd className="mp-wallet-address">
                    <span title={active.address || active.name}>
                      {active.address
                        ? `${active.address.slice(0, 8)}…${active.address.slice(-6)}`
                        : active.name}
                    </span>
                    <button
                      aria-label="Copy wallet address"
                      className="mp-icon"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(active.address || active.id)
                          .then(() => notify('Wallet address copied.'))
                      }
                    >
                      <Copy size={16} />
                    </button>
                  </dd>
                </div>
                {state?.networkName && (
                  <div>
                    <dt>Network</dt>
                    <dd>{state.networkName}</dd>
                  </div>
                )}

                <div>
                  <dt>
                    <ShieldCheck size={15} /> Identity
                  </dt>
                  <dd className={active.verified ? 'mp-verified' : ''}>
                    {active.verified ? 'Human verified' : 'Not verified'}
                  </dd>
                </div>
              </dl>
              <p className="mp-small mp-muted">
                Sepolia test assets have no monetary value. You also need Sepolia ETH for
                transaction fees.
              </p>
              {state?.network === 'unsupported' && (
                <button
                  className="mp-button primary full"
                  disabled={busy}
                  onClick={() => void session('switchNetwork')}
                >
                  Switch network
                </button>
              )}
              <button
                className="mp-button primary full"
                disabled={busy || state?.network !== 'supported'}
                onClick={() =>
                  transact(
                    'Get demo USDC',
                    'Request test USDC from the Sepolia faucet. Confirm the transaction in your wallet.',
                    { type: 'faucet' },
                  )
                }
              >
                <Droplets size={18} />
                Get demo USDC
              </button>
              {!active.verified && (
                <button
                  className="mp-button full"
                  disabled={busy || state?.network !== 'supported'}
                  onClick={() => void session('verify')}
                >
                  Verify with World
                </button>
              )}
              <button
                className="mp-button full"
                disabled={busy}
                onClick={() => void session('changeWallet')}
              >
                <RefreshCw size={17} />
                Change wallet
              </button>
              <button className="mp-button full" disabled={busy} onClick={() => void disconnect()}>
                <LogOut size={17} /> Disconnect
              </button>
            </>
          )}
          {walletError && (
            <p className="mp-error" role="alert">
              {walletError}
            </p>
          )}
          {!active && client && (
            <button
              className="mp-button primary full"
              disabled={busy}
              onClick={() => void session('connect')}
            >
              {busy ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </WalletPopover>
      )}
      {transaction && (
        <MarketDialog title={transaction.title} close={() => setTransaction(null)} busy={busy}>
          <p className="mp-muted">
            {transaction.confirmed
              ? 'This action already completed. Refreshing updates your balances and activity without submitting it again.'
              : transaction.description}
          </p>
          <dl className="mp-rows">
            <div>
              <dt>Account</dt>
              <dd>{active?.address || active?.name}</dd>
            </div>
            {state?.networkName && (
              <div>
                <dt>Network</dt>
                <dd>{state.networkName}</dd>
              </div>
            )}
          </dl>
          {txError && (
            <p className="mp-error" role="alert">
              {txError}
              {progress?.hash && (
                <a
                  className="mp-transaction-link"
                  href={`https://sepolia.etherscan.io/tx/${progress.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {transaction.confirmed
                    ? 'View confirmed transaction'
                    : 'View submitted transaction'}{' '}
                  <ArrowUpRight size={14} />
                </a>
              )}
            </p>
          )}
          {busy && (
            <p className="mp-muted" role="status">
              {transaction.confirmed
                ? 'Updating balances and activity…'
                : 'Complete the request in your wallet, then wait for confirmation.'}
            </p>
          )}
          <div className="mp-dialog-actions">
            <button className="mp-button" disabled={busy} onClick={() => setTransaction(null)}>
              Cancel
            </button>
            <button className="mp-button primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? (
                <>
                  <LoaderCircle size={18} className="spin" />{' '}
                  {transaction.confirmed ? 'Refreshing…' : 'Confirming…'}
                </>
              ) : (
                <>
                  {transaction.confirmed ? 'Refresh balances' : 'Confirm'} <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </MarketDialog>
      )}
      {toast && (
        <div className="mp-toast" role="status">
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast('')}>
            <X size={18} />
          </button>
        </div>
      )}
      {busy && !sessionBusy && progress && (
        <div className="mp-transaction-progress" role="status" aria-live="polite">
          <div className="mp-progress-icon">
            <LoaderCircle className="spin" size={23} />
          </div>
          <div>
            <strong>{progress.label}</strong>
            <span>
              {progress.phase === 'pending'
                ? 'Submitted. Waiting for the network.'
                : progress.phase === 'wallet'
                  ? 'Your wallet or verification dialog needs attention.'
                  : 'Please keep this page open.'}
            </span>
            <div className="mp-progress-steps">
              {['preparing', 'wallet', 'pending', 'confirmed'].map((phase, i) => (
                <span
                  key={phase}
                  className={
                    i <=
                    ['preparing', 'wallet', 'pending', 'confirmed', 'refreshing'].indexOf(
                      progress.phase,
                    )
                      ? 'done'
                      : ''
                  }
                >
                  {['Check', 'Approve', 'Confirm', 'Update'][i]}
                </span>
              ))}
            </div>
            {progress.hash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${progress.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </div>
      )}
    </MarketContext.Provider>
  );
}
