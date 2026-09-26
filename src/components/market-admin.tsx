'use client';
import Link from 'next/link';
import { useMarket } from './market-provider';
import { dateLabel, display, topBid } from '@/lib/market';
import {
  AccessButton,
  Badge,
  Empty,
  MarketUnavailable,
  MarketShell,
  PageTitle,
  Rows,
} from './market-ui';
export default function MarketAdmin() {
  const { state, wallet, transact } = useMarket();
  if (!state) return <MarketUnavailable />;
  const admin = state.people.find((p) => p.id === state.current)?.role === 'admin';
  const queue = state.campaigns.filter(
    (c) => c.status === 'booked' && c.held > 0 && state.now >= c.end,
  );
  return (
    <MarketShell>
      <PageTitle
        eyebrow="ADMIN"
        title="Campaign review"
        text="Review proof and refund held payments when a campaign is not fulfilled."
        action={
          !state.current ? (
            <button className="mp-button" onClick={wallet}>
              Connect wallet
            </button>
          ) : undefined
        }
      />
      {!admin ? (
        <Empty
          title="Admin access required"
          text="Sign in with an authorized wallet to review campaigns."
          href="/"
          action="Back to marketplace"
        />
      ) : queue.length ? (
        <div className="mp-stack">
          {queue.map((c) => {
            const asset = state.assets.find((a) => a.id === c.assetId),
              winner = topBid(c);
            if (!asset || !winner) return null;
            return (
              <section className="mp-box" key={c.id}>
                <div className="mp-section-heading">
                  <h2>
                    {asset.name} · {asset.draft.spots.find((s) => s.id === c.slotId)?.name}
                  </h2>
                  <Badge tone={c.proofResult === 'match' ? 'green' : 'amber'}>
                    {c.proofResult === 'match'
                      ? 'Proof accepted'
                      : c.proofResult === 'inconclusive'
                        ? 'Needs review'
                        : c.proofResult === 'pending'
                          ? 'Proof pending'
                          : 'No proof submitted'}
                  </Badge>
                </div>
                <div className="mp-admin-grid">
                  <div>
                    {c.proof ? (
                      <img
                        className="mp-proof-image"
                        src={c.proof.url}
                        alt="Submitted campaign proof"
                      />
                    ) : (
                      <div className="mp-empty">No proof image submitted.</div>
                    )}
                    <p className="mp-muted">
                      {c.proofResult === 'inconclusive'
                        ? 'Proof could not be verified. Payment remains held.'
                        : c.proofResult === 'match'
                          ? 'Proof accepted. The creator can release the held payment.'
                          : c.proofResult === 'pending'
                            ? 'Proof is awaiting verification.'
                            : 'Awaiting proof from the creator.'}
                    </p>
                    <div className="mp-original-art">
                      <img src={winner.artwork.url} alt="Original winning artwork" />
                      <span>Original winning artwork · {winner.artwork.name}</span>
                    </div>
                  </div>
                  <div>
                    <Rows
                      rows={[
                        ['Winning bid', `${display(winner.amount)} USDC`],
                        ['Already released', `${display(c.upfront)} USDC`],
                        ['Available to refund', `${display(c.held)} USDC`],
                        ['Display ended', dateLabel(c.end)],
                        [
                          'Refund recipient',
                          state.people.find((p) => p.id === winner.user)?.name ?? winner.user,
                        ],
                      ]}
                    />
                    <AccessButton
                      onClick={() =>
                        transact(
                          'Refund campaign',
                          `Return ${display(c.held)} USDC to the winning advertiser and close this campaign. Previously released payments are not refunded.`,
                          { type: 'refund', campaignId: c.id },
                        )
                      }
                    >
                      Refund {display(c.held)} USDC
                    </AccessButton>
                    <Link className="mp-button full" href={`/assets/${asset.id}?slot=${c.slotId}`}>
                      View campaign
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty
          title="No campaigns to review"
          text="Completed display periods with held payments will appear here."
        />
      )}
      {admin && state.campaigns.some((c) => c.status === 'refunded') && (
        <section className="mp-box mp-activity">
          <h3>Completed refunds</h3>
          {state.campaigns
            .filter((c) => c.status === 'refunded')
            .map((c) => (
              <div key={c.id}>
                <span>
                  {state.assets.find((a) => a.id === c.assetId)?.name} · {c.slotId}
                </span>
                <Badge tone="green">Refunded</Badge>
              </div>
            ))}
        </section>
      )}
    </MarketShell>
  );
}
