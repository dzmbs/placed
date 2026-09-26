'use client';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  useConnectWallet,
  useConnectOrCreateWallet,
} from '@privy-io/react-auth';
import type { Address, EIP1193Provider } from 'viem';
import { marketplaceChain } from '@/lib/marketplace/config';
import { MarketplaceProvider } from './context';
import styles from './marketplace.module.css';

export interface WalletConnection {
  wallet: Address;
  provider: () => Promise<EIP1193Provider>;
}
export default function MarketplaceProviders({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId)
    return (
      <MarketplaceProvider
        walletControl={<span className={styles.muted}>Privy app ID is not configured.</span>}
      >
        {children}
      </MarketplaceProvider>
    );
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
      <PrivyMarketplace>{children}</PrivyMarketplace>
    </PrivyProvider>
  );
}
function PrivyMarketplace({ children }: { children: ReactNode }) {
  const { ready, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const [selected, setSelected] = useState<string>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const chooseWallet = ({ wallet }: { wallet: { address: string } }) => {
    setSelected(wallet.address.toLowerCase());
    setAccountOpen(false);
    setError('');
  };
  const onError = () => setError('Wallet connection was cancelled or unavailable. Try again.');
  const { connectOrCreateWallet } = useConnectOrCreateWallet({ onSuccess: chooseWallet, onError });
  const { connectWallet } = useConnectWallet({ onSuccess: chooseWallet, onError });
  const active = wallets.find((wallet) => wallet.address.toLowerCase() === selected) || wallets[0];
  const activeRef = useRef(active);
  activeRef.current = active;
  const connection = useMemo<WalletConnection | undefined>(() => {
    if (!ready || !walletsReady || !active || disconnecting) return;
    return {
      wallet: active.address as Address,
      provider: async () => {
        const current = activeRef.current;
        if (!current || current.address.toLowerCase() !== active.address.toLowerCase())
          throw new Error('The connected wallet changed. Reconnect before continuing.');
        let provider = await current.getEthereumProvider();
        const chain = await provider.request({ method: 'eth_chainId' });
        if (Number(chain) !== marketplaceChain.id) {
          await current.switchChain(marketplaceChain.id);
          provider = await current.getEthereumProvider();
        }
        return provider as EIP1193Provider;
      },
    };
  }, [ready, walletsReady, active?.address, disconnecting]);
  return (
    <MarketplaceProvider
      connection={connection}
      walletControl={
        <div className={styles.walletAccount}>
          <button
            disabled={!ready || !walletsReady || disconnecting}
            aria-expanded={active ? accountOpen : undefined}
            onClick={() => (active ? setAccountOpen(!accountOpen) : connectOrCreateWallet())}
          >
            {!ready || !walletsReady
              ? 'Loading wallet…'
              : active
                ? `${active.address.slice(0, 6)}…${active.address.slice(-4)}`
                : 'Connect wallet'}
          </button>
          {accountOpen && active && (
            <div className={styles.walletMenu}>
              <strong>Your wallet</strong>
              <span className={styles.code}>{active.address}</span>
              <span className={styles.muted}>Ethereum Sepolia</span>
              <button
                onClick={() => {
                  setAccountOpen(false);
                  connectWallet();
                }}
              >
                Change wallet
              </button>
              <button
                disabled={disconnecting}
                onClick={async () => {
                  setDisconnecting(true);
                  try {
                    await logout();
                    setSelected(undefined);
                    setAccountOpen(false);
                  } catch {
                    setError('Could not disconnect. Try again.');
                  } finally {
                    setDisconnecting(false);
                  }
                }}
              >
                Disconnect
              </button>
            </div>
          )}
          {error && (
            <span role="alert" className={styles.muted}>
              {error}
            </span>
          )}
        </div>
      }
    >
      {children}
    </MarketplaceProvider>
  );
}
