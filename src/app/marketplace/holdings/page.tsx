'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { erc20Abi, parseUnits } from 'viem';
import type { Asset } from '@/lib/marketplace/domain';
import { browserPublicClient, redeemShares } from '@/lib/marketplace/client';
import { useMarketplace } from '@/components/marketplace/context';
import {
  useRecord,
  useClock,
  tokens,
  dollars,
  time,
  Metrics,
  ErrorMessage,
} from '@/components/marketplace/shared';
import styles from '@/components/marketplace/marketplace.module.css';
function Holding({ asset }: { asset: Asset }) {
  const market = useMarketplace(),
    now = useClock();
  const series = asset.financing!;
  const [balance, setBalance] = useState('0'),
    [amount, setAmount] = useState('');
  useEffect(() => {
    if (!market.wallet) {
      setBalance('0');
      return;
    }
    let active = true;
    browserPublicClient
      .readContract({
        address: series.token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [market.wallet],
      })
      .then((value) => {
        if (active) setBalance(String(value));
      })
      .catch(() => setBalance('0'));
    return () => {
      active = false;
    };
  }, [series.token, market.wallet, market.revision]);
  const ready = series.activated && now >= series.termEnd && series.unresolvedCampaigns === '0';
  const entitlement =
    BigInt(series.totalSupply) > 0n
      ? (BigInt(series.accountedRevenue) * BigInt(balance)) / BigInt(series.totalSupply)
      : 0n;
  return (
    <section className={styles.panel}>
      <h2>{asset.metadata?.title || `Asset ${asset.id}`}</h2>
      <Metrics
        items={[
          ['Your tokens', tokens(balance)],
          ['Current proportional vault claim', dollars(entitlement)],
          ['Unresolved covered campaigns', series.unresolvedCampaigns],
          ['Term ends', time(series.termEnd)],
        ]}
      />
      <p className={styles.muted}>
        Claim CCA allocations before redeeming. Tokens held in an LP must be removed from liquidity
        first. Redeeming burns your tokens and pays actual collected revenue.
      </p>
      <Link className={styles.button} href={`/marketplace/assets/${asset.id}`}>
        Sale and token market ↗
      </Link>
      {ready ? (
        <>
          <label>
            Tokens to redeem
            <input
              value={amount}
              placeholder="Token amount"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button
            disabled={market.busy || !market.wallet || BigInt(balance) === 0n || !amount}
            onClick={() =>
              void market.run('Burn revenue tokens and redeem collected USDC', () =>
                redeemShares(market.wallet!, series.token, parseUnits(amount, 18)),
              )
            }
          >
            Redeem
          </button>
        </>
      ) : (
        <p>
          {!series.activated
            ? 'Financing has not activated.'
            : now < series.termEnd
              ? 'Redemption opens after the fixed term ends.'
              : 'Redemption waits for every covered campaign across this asset’s slots to settle.'}
        </p>
      )}
    </section>
  );
}
export default function Page() {
  const market = useMarketplace();
  const { record, error } = useRecord<Asset[]>('/assets');
  return (
    <>
      <p className={styles.eyebrow}>Your asset revenue shares</p>
      <h1>Holdings and redemption.</h1>
      <ErrorMessage error={error} />
      {!market.wallet && <p>Connect a wallet to read your balances.</p>}
      <div className={styles.stack}>
        {record
          ?.filter((asset) => asset.financing)
          .map((asset) => (
            <Holding key={asset.id} asset={asset} />
          ))}
      </div>
      {record && !record.some((asset) => asset.financing) && (
        <p>
          No asset financing launches exist yet. Creators can choose Raise capital from their asset
          dashboard.
        </p>
      )}
    </>
  );
}
