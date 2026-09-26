'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  useConnectWallet,
  useConnectOrCreateWallet,
} from '@privy-io/react-auth';
import type { Address, EIP1193Provider } from 'viem';
import { marketplaceChain } from '@/lib/marketplace/config';
import { createMarketAdapter, type MarketWallet } from '@/lib/marketplace/market-adapter';
import { MarketplaceProvider, useMarketplace } from './marketplace/context';
import type { WalletConnection } from './marketplace/providers';
import { MarketProvider } from './market-provider';

export default function SepoliaProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <PublicMarket>{children}</PublicMarket>;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email'],
        defaultChain: marketplaceChain,
        supportedChains: [marketplaceChain],
        appearance: {
          theme: 'light',
          accentColor: '#728d35',
          walletChainType: 'ethereum-only',
          showWalletLoginFirst: true,
        },
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
      }}
    >
      <WalletBridge>{children}</WalletBridge>
    </PrivyProvider>
  );
}
function PublicMarket({ children }: { children: ReactNode }) {
  const unavailable = async (): Promise<never> => {
    throw new Error('Wallet connection is not configured. Set the Privy app ID and reload.');
  };
  const adapter = useMemo(
    () =>
      createMarketAdapter({
        address: () => undefined,
        provider: unavailable,
        connect: unavailable,
        disconnect: unavailable,
        switchNetwork: unavailable,
        verify: unavailable,
        authenticate: unavailable,
        session: () => undefined,
      }),
    [],
  );
  return <MarketProvider client={adapter}>{children}</MarketProvider>;
}
type Controls = Pick<
  MarketWallet,
  'address' | 'provider' | 'connect' | 'disconnect' | 'switchNetwork'
>;
function WalletBridge({ children }: { children: ReactNode }) {
  const { ready, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [selected, setSelected] = useState<string>();
  const [hidden, setHidden] = useState(false);
  // Bumped on every Privy success so the check below re-runs even when the
  // chosen wallet was already active (its address alone would not change).
  const [chosen, setChosen] = useState(0);
  const active = hidden
    ? undefined
    : (wallets.find((w) => w.address.toLowerCase() === selected) ?? wallets[0]);
  const activeRef = useRef(active);
  activeRef.current = active;
  const pending = useRef<
    | {
        resolve: () => void;
        reject: (error: Error) => void;
        address?: string;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined
  >(undefined);
  function choose({ wallet }: { wallet: { address: string } }) {
    setHidden(false);
    setSelected(wallet.address.toLowerCase());
    setChosen((value) => value + 1);
    console.info('[wallet] Privy connected', { wallet: wallet.address });
    if (pending.current) pending.current.address = wallet.address.toLowerCase();
  }
  function cancelled(error?: unknown) {
    if (pending.current) {
      console.warn('[wallet] Privy connection failed or was closed', error);
      clearTimeout(pending.current.timer);
      pending.current.reject(new Error('Wallet connection cancelled.'));
      pending.current = undefined;
    }
  }
  const { connectOrCreateWallet } = useConnectOrCreateWallet({
    onSuccess: choose,
    onError: cancelled,
  });
  const { connectWallet } = useConnectWallet({ onSuccess: choose, onError: cancelled });
  useEffect(() => {
    if (pending.current?.address && active?.address.toLowerCase() === pending.current.address) {
      clearTimeout(pending.current.timer);
      pending.current.resolve();
      pending.current = undefined;
      console.info('[wallet] active', { wallet: active?.address, chainId: active?.chainId });
    }
    window.dispatchEvent(new Event('placed-wallet-change'));
  }, [active?.address, active?.chainId, ready, walletsReady, chosen]);
  useEffect(() => () => cancelled(), []);
  useEffect(() => {
    console.info('[wallet] Privy state', {
      ready,
      walletsReady,
      wallets: wallets.map((w) => w.address),
    });
  }, [ready, walletsReady, wallets]);
  const controls: Controls = {
    address: () => activeRef.current?.address as Address | undefined,
    provider: async () => {
      if (!activeRef.current) throw new Error('Connect a wallet first.');
      return (await activeRef.current.getEthereumProvider()) as EIP1193Provider;
    },
    connect: async (change = false) => {
      if (!ready || !walletsReady)
        throw new Error(
          `Privy is still starting. If it does not finish, allow ${window.location.origin} in your Privy app’s Domains and reload.`,
        );
      if (activeRef.current && !change) return;
      await new Promise<void>((resolve, reject) => {
        console.info('[wallet] opening Privy', { change });
        const timer = setTimeout(() => {
          console.warn('[wallet] connection timed out waiting for Privy');
          pending.current = undefined;
          reject(new Error('Wallet connection timed out. Try again.'));
        }, 120000);
        pending.current = { resolve, reject, timer };
        if (change) connectWallet();
        else connectOrCreateWallet();
      });
    },
    disconnect: async () => {
      await logout();
      setHidden(true);
      activeRef.current = undefined;
      setSelected(undefined);
    },
    switchNetwork: async () => {
      if (!activeRef.current) throw new Error('Connect a wallet first.');
      await activeRef.current.switchChain(marketplaceChain.id);
    },
  };
  const connection = useMemo<WalletConnection | undefined>(
    () =>
      active
        ? {
            wallet: active.address as Address,
            provider: async () => {
              const current = activeRef.current;
              if (!current || current.address.toLowerCase() !== active.address.toLowerCase())
                throw new Error('Your wallet changed. Try again.');
              return (await current.getEthereumProvider()) as EIP1193Provider;
            },
          }
        : undefined,
    [active?.address],
  );
  return (
    <MarketplaceProvider headless connection={connection} walletControl={null}>
      <ConnectedMarket controls={controls}>{children}</ConnectedMarket>
    </MarketplaceProvider>
  );
}
function ConnectedMarket({ children, controls }: { children: ReactNode; controls: Controls }) {
  const marketplace = useMarketplace();
  const bridge = useRef({
    ...controls,
    verify: marketplace.verify,
    authenticate: marketplace.authenticate,
    session: () => marketplace.session,
  });
  bridge.current = {
    ...controls,
    verify: marketplace.verify,
    authenticate: marketplace.authenticate,
    session: () => marketplace.session,
  };
  const adapter = useMemo(
    () =>
      createMarketAdapter({
        address: () => bridge.current.address(),
        provider: () => bridge.current.provider(),
        connect: (change) => bridge.current.connect(change),
        disconnect: () => bridge.current.disconnect(),
        switchNetwork: () => bridge.current.switchNetwork(),
        verify: () => bridge.current.verify(),
        authenticate: () => bridge.current.authenticate(),
        session: () => bridge.current.session(),
      }),
    [],
  );
  return <MarketProvider client={adapter}>{children}</MarketProvider>;
}
