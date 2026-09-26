'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Asset, AdvertisingCampaign, ProofResult } from '@/lib/marketplace/domain';
import * as client from '@/lib/marketplace/client';
import { useMarketplace } from './context';
import { useRecord, useClock, dollars, time, Metrics, ErrorMessage } from './shared';
import styles from './marketplace.module.css';

export default function Settlement({ id, admin = false }: { id: string; admin?: boolean }) {
  const market = useMarketplace();
  const now = useClock();
  const { record, error } = useRecord<{ asset: Asset; campaign: AdvertisingCampaign }>(
    `/campaigns/${id}`,
  );
  const [proof, setProof] = useState<ProofResult | null>();
  const [photo, setPhoto] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [proofError, setProofError] = useState('');
  useEffect(() => {
    if (!photo) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    setProof(undefined);
    if (market.session)
      client
        .api<{ proof: ProofResult | null }>(`/campaigns/${id}/proof`, undefined, market.session)
        .then((result) => {
          setProof(result.proof);
          setProofError('');
        })
        .catch((error) => setProofError(error.message));
  }, [id, market.session, market.revision]);
  if (!record)
    return (
      <>
        <ErrorMessage error={error} />
        {!error && <p>Loading campaign…</p>}
      </>
    );
  const { campaign, asset } = record;
  const creator = market.wallet?.toLowerCase() === asset.creator.wallet.toLowerCase();
  const ready = campaign.state === 'displaying' && now >= campaign.displayEnd;
  const slot = asset.slots.find((slot) => slot.id === campaign.slotId);
  return (
    <>
      <p className={styles.eyebrow}>
        Campaign {id} / {slot?.metadata?.name || `Slot ${campaign.slotId}`}
      </p>
      <h1>{admin ? 'Review held escrow' : 'Proof and settlement'}</h1>
      <Link className={styles.button} href={`/marketplace/assets/${asset.id}`}>
        Back to asset ↗
      </Link>
      <ErrorMessage error={error || proofError} />
      <div className={styles.split}>
        <section className={styles.panel}>
          <h2>Original winning artwork</h2>
          {campaign.winningArtworkURI ? (
            <img
              className={styles.proof}
              src={campaign.winningArtworkURI}
              alt="Immutable original winning artwork"
            />
          ) : (
            <p>No winning artwork.</p>
          )}
          <p className={styles.code}>{campaign.winningArtworkHash}</p>
          <Metrics
            items={[
              ['Winning bid', dollars(campaign.bid)],
              ['Remaining escrow', dollars(campaign.held)],
              ['Creator share of release', `${100 - campaign.revenueBps / 100}%`],
              ['Asset vault share', `${campaign.revenueBps / 100}%`],
            ]}
          />
          <p>Display ends: {time(campaign.displayEnd)}</p>
          <p>State: {campaign.state}</p>
          <p className={styles.muted}>
            A proof photo can support logo and placement matching. It cannot establish continuous
            visibility throughout the display period.
          </p>
        </section>
        <section className={styles.panel}>
          <h2>{admin ? 'Creator proof' : 'Show the ad in place'}</h2>
          {!market.session && (
            <button
              disabled={market.busy || !market.wallet}
              onClick={() => void market.run('Sign in to view campaign proof', market.authenticate)}
            >
              Sign in for proof access
            </button>
          )}
          {proof && (
            <>
              <img
                className={styles.proof}
                src={proof.photoURI}
                alt="Submitted physical display proof"
              />
              <h3>{proof.outcome}</h3>
              <p>{proof.explanation}</p>
            </>
          )}
          {!admin && creator && ready && BigInt(campaign.held) > 0n && (
            <>
              <label>
                Upload a real proof photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setPhoto(e.target.files?.[0])}
                />
              </label>
              {preview && <img className={styles.proof} src={preview} alt="Proof upload preview" />}
              <button
                disabled={market.busy || !photo}
                onClick={() =>
                  void market.run('Verify photo against winning artwork', async () => {
                    const session = await market.authenticate();
                    const result = await client.api<ProofResult>(
                      `/campaigns/${id}/proof`,
                      { method: 'POST', headers: { 'content-type': photo!.type }, body: photo },
                      session,
                    );
                    setProof(result);
                    return result;
                  })
                }
              >
                Verify proof photo
              </button>
              <p className={styles.muted}>
                The backend verifier authorizes release only for a match. No match or uncertainty
                leaves all remaining escrow held.
              </p>
            </>
          )}
          {!admin && proof?.authorization && ready && (
            <button
              disabled={market.busy || !market.wallet || proof.authorization.deadline <= now}
              onClick={() =>
                void market.run('Release verified campaign escrow', () =>
                  client.releaseEscrow(market.wallet!, proof.authorization!),
                )
              }
            >
              Release held escrow
            </button>
          )}
          {!admin && ready && campaign.held === '0' && (
            <button
              disabled={market.busy || !market.wallet}
              onClick={() =>
                void market.run('Complete zero-escrow campaign and revoke artwork permission', () =>
                  client.completeZeroEscrow(market.wallet!, id),
                )
              }
            >
              Complete campaign and revoke permissions
            </button>
          )}
          {!ready && campaign.state === 'displaying' && (
            <p>Proof settlement opens after the display period ends.</p>
          )}
          {admin &&
            campaign.state === 'displaying' &&
            BigInt(campaign.held) > 0n &&
            market.balances?.admin && (
              <>
                <p className={styles.warning}>
                  This returns the entire remaining {dollars(campaign.held)} to the winning
                  advertiser. Previously released funds are unchanged. Refund and proof release are
                  mutually exclusive.
                </p>
                <button
                  disabled={market.busy}
                  onClick={() =>
                    void market.run('Refund all remaining campaign escrow', () =>
                      client.refundEscrow(market.wallet!, id),
                    )
                  }
                >
                  Refund remaining escrow
                </button>
              </>
            )}
          <p className={styles.muted}>
            Backend proof verification and the refund admin are explicit trust dependencies. Payment
            authority is enforced by the deployed contracts.
          </p>
        </section>
      </div>
    </>
  );
}
