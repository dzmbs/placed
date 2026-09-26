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
import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import type { MarketAction, MarketState } from '@/lib/market';
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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="mp-dialog"
      aria-label={title}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div className="mp-dialog-inner">
        <button className="mp-close" aria-label="Close dialog" onClick={close} disabled={busy}>
          <X size={22} />
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
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

  const session = async (method: 'connect' | 'verify' | 'switchNetwork') => {
    if (!client) {
      setWalletError(unavailableMessage);
      setWalletOpen(true);
      return false;
    }
    if (pending.current) return false;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setWalletError('');
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
        setWalletError(
          err instanceof Error ? err.message : 'Could not complete the request. Please try again.',
        );
        setWalletOpen(true);
      }
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
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
      if (mounted.current) setBusy(false);
    }
  };
  const wallet = () => {
    setWalletError('');
    if (current.current?.current) setWalletOpen(true);
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
    setTransaction({ title, description, action, onSuccess, user: current.current.current });
  };
  const confirm = async () => {
    if (!transaction || !client || pending.current) return;
    const tx = transaction;
    pending.current = true;
    generation.current++;
    setBusy(true);
    setTxError('');
    try {
      // Refresh before signing so account/network changes invalidate an old review.
      const latest = await client.getState();
      if (!mounted.current) return;
      accept(latest);
      assertCanConfirm(latest, tx.action, tx.user);
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
      if (mounted.current)
        setTxError(
          err instanceof Error
            ? err.message
            : 'Transaction could not be completed. Please try again.',
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
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
        <MarketDialog
          title={active ? 'Your wallet' : 'Connect wallet'}
          close={() => setWalletOpen(false)}
          busy={busy}
        >
          {active && (
            <>
              <dl className="mp-rows">
                <div>
                  <dt>Account</dt>
                  <dd>{active.address || active.name}</dd>
                </div>
                {state?.networkName && (
                  <div>
                    <dt>Network</dt>
                    <dd>{state.networkName}</dd>
                  </div>
                )}
              </dl>
              {state?.network === 'unsupported' && (
                <button
                  className="mp-button primary full"
                  disabled={busy}
                  onClick={() => void session('switchNetwork')}
                >
                  Switch network
                </button>
              )}
              <button className="mp-button full" disabled={busy} onClick={() => void disconnect()}>
                Disconnect
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
        </MarketDialog>
      )}
      {transaction && (
        <MarketDialog title={transaction.title} close={() => setTransaction(null)} busy={busy}>
          <p className="mp-muted">{transaction.description}</p>
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
            </p>
          )}
          {busy && (
            <p className="mp-muted" role="status">
              Complete the request in your wallet, then wait for confirmation.
            </p>
          )}
          <div className="mp-dialog-actions">
            <button className="mp-button" disabled={busy} onClick={() => setTransaction(null)}>
              Cancel
            </button>
            <button className="mp-button primary" disabled={busy} onClick={() => void confirm()}>
              {busy ? (
                <>
                  <LoaderCircle size={18} className="spin" /> Confirming…
                </>
              ) : (
                <>
                  Confirm <ArrowRight size={18} />
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
    </MarketContext.Provider>
  );
}
