'use client';
import { useState } from 'react';
import type { AdSlot, Asset } from '@/lib/marketplace/domain';
import { createCampaign } from '@/lib/marketplace/client';
import { useMarketplace } from './context';
import styles from './marketplace.module.css';
export function localDate(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export default function CampaignForm({ slot, asset }: { slot: AdSlot; asset: Asset }) {
  const market = useMarketplace();
  const [minutes, setMinutes] = useState('5');
  const [duration, setDuration] = useState('5');
  const [start, setStart] = useState(() =>
    localDate(
      Math.max(
        Date.now() / 1000 + 12 * 60,
        asset.financing?.activated ? asset.financing.termStart + 60 : 0,
      ),
    ),
  );
  const [increase, setIncrease] = useState('10');
  const [escrow, setEscrow] = useState('60');
  return (
    <section className={styles.panel}>
      <h2>Open the next campaign</h2>
      <p>One campaign at a time for this slot. Other slots can run independently.</p>
      <div className={styles.row}>
        <label>
          Bidding duration, minutes
          <input
            type="number"
            min="1"
            max="10080"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label>
          Display duration, minutes
          <input
            type="number"
            min="1"
            max="525600"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>
      <label>
        Display starts, local time
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <div className={styles.row}>
        <label>
          Minimum bid increase, %
          <input
            type="number"
            min="0"
            max="100"
            step=".01"
            value={increase}
            onChange={(e) => setIncrease(e.target.value)}
          />
        </label>
        <label>
          Held in escrow, %
          <input
            type="number"
            min="0"
            max="100"
            step=".01"
            value={escrow}
            onChange={(e) => setEscrow(e.target.value)}
          />
        </label>
      </div>
      <p className={styles.muted}>
        Demo timing is real. Bidding opens one minute after submission and must finish before
        display starts. Terms lock when created.
      </p>
      <button
        disabled={market.busy || !market.wallet}
        onClick={() =>
          void market.run('Create advertising campaign', async () => {
            const bidStart = BigInt(Math.floor(Date.now() / 1000) + 60);
            const bidEnd = bidStart + BigInt(Math.round(Number(minutes) * 60));
            const displayStart = BigInt(Math.floor(new Date(start).getTime() / 1000));
            const displayEnd = displayStart + BigInt(Math.round(Number(duration) * 60));
            const minIncreaseBps = Math.round(Number(increase) * 100),
              escrowBps = Math.round(Number(escrow) * 100);
            if (bidEnd >= displayStart) throw Error('Bidding must end before display starts.');
            if (
              asset.financing?.activated &&
              displayStart < BigInt(asset.financing.termEnd) &&
              displayEnd > BigInt(asset.financing.termStart) &&
              (displayStart < BigInt(asset.financing.termStart) ||
                displayEnd > BigInt(asset.financing.termEnd))
            )
              throw Error('Covered campaigns must fit entirely within the asset’s financing term.');
            return createCampaign(market.wallet!, slot.id, {
              bidStart,
              bidEnd,
              displayStart,
              displayEnd,
              minIncreaseBps,
              escrowBps,
            });
          })
        }
      >
        Create campaign
      </button>
    </section>
  );
}
