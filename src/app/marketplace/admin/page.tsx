'use client';
import { useState } from 'react';
import type { AdvertisingCampaign } from '@/lib/marketplace/domain';
import { useMarketplace } from '@/components/marketplace/context';
import { useRecord, dollars, ErrorMessage } from '@/components/marketplace/shared';
import Settlement from '@/components/marketplace/settlement';
import styles from '@/components/marketplace/marketplace.module.css';
export default function Page() {
  const market = useMarketplace();
  const { record, error } = useRecord<AdvertisingCampaign[]>('/campaigns');
  const [selected, setSelected] = useState('');
  if (!market.balances?.admin)
    return (
      <>
        <h1>Escrow administration</h1>
        <p>
          Connect the authorized refund admin wallet. Contract access control protects every refund.
        </p>
      </>
    );
  return (
    <>
      <h1>Held campaign escrows</h1>
      <ErrorMessage error={error} />
      <div className={styles.controls}>
        {record
          ?.filter((c) => c.state === 'displaying' && BigInt(c.held) > 0n)
          .map((c) => (
            <button
              className={selected === c.id ? styles.active : undefined}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              Campaign {c.id} · {dollars(c.held)}
            </button>
          ))}
      </div>
      {record && !record.some((c) => c.state === 'displaying' && BigInt(c.held) > 0n) && (
        <p>No campaigns have held escrow.</p>
      )}
      {selected && <Settlement key={selected} id={selected} admin />}
    </>
  );
}
