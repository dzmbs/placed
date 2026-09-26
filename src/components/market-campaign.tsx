'use client';
import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import {
  campaignStatus,
  dateLabel,
  display,
  minimumBid,
  topBid,
  type Artwork,
  type CampaignRecord,
  type MarketAsset,
} from '@/lib/market';
import { useMarket } from './market-provider';
import { AccessButton, Badge, Rows, SpendButton } from './market-ui';
import { MediaInput } from './market-media';
import { amountOrZero, localDate } from './market-finance';

export function CampaignForm({
  asset,
  slotId,
  close,
}: {
  asset: MarketAsset;
  slotId: string;
  close: () => void;
}) {
  const { state, transact } = useMarket(),
    [error, setError] = useState('');
  if (!state) return null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget),
          date = (key: string) => Date.parse(String(data.get(key)));
        const opens = date('opens'),
          closes = date('closes'),
          start = date('start'),
          end = date('end');
        if (![opens, closes, start, end].every(Number.isFinite)) {
          setError('Enter a date and time for each field.');
          return;
        }
        if (
          opens <= Date.now() + 30000 ||
          closes <= opens ||
          closes <= state.now ||
          start <= closes ||
          end <= start
        ) {
          setError(
            'Leave at least a minute before bidding opens for wallet confirmation. Close bidding before display starts, and end the display after it starts.',
          );
          return;
        }
        const startingBid = 1_000_000;
        setError('');
        transact(
          'Create auction',
          `${asset.draft.spots.find((s) => s.id === slotId)?.name}: bidding from ${display(startingBid, 6)} USDC until ${dateLabel(closes)}. Display runs ${dateLabel(start)} to ${dateLabel(end)}, with ${data.get('escrow')}% of payment held until proof. These terms cannot be changed after confirmation.`,
          {
            type: 'campaign',
            terms: {
              assetId: asset.id,
              slotId,
              startingBid,
              opens,
              closes,
              start,
              end,
              increment: Math.round(Number(data.get('increment')) * 100),
              escrowPercent: Math.round(Number(data.get('escrow')) * 100),
            },
          },
          close,
        );
      }}
    >
      <p className="mp-muted">
        {asset.draft.spots.find((s) => s.id === slotId)?.name} · {asset.draft.campaign.title}
      </p>
      <div className="mp-form-grid">
        <label>
          Bidding opens
          <input
            name="opens"
            type="datetime-local"
            defaultValue={localDate(Date.now() + 3 * 60000)}
            required
          />
        </label>
        <label>
          Bidding closes
          <input
            name="closes"
            type="datetime-local"
            defaultValue={asset.draft.campaign.auctionEnd}
            required
          />
        </label>
        <label>
          Display starts
          <input
            name="start"
            type="datetime-local"
            defaultValue={`${asset.draft.campaign.startDate}T00:00`}
            required
          />
        </label>
        <label>
          Display ends
          <input
            name="end"
            type="datetime-local"
            defaultValue={`${asset.draft.campaign.endDate}T23:59`}
            required
          />
        </label>
        <label>
          Minimum bid increase (%)
          <input
            name="increment"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            defaultValue="10"
            required
          />
        </label>
        <label>
          Payment held until proof (%)
          <input
            name="escrow"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue="60"
            required
          />
        </label>
      </div>
      <div className="mp-note">
        Auctions begin with no bids. The first bid must be at least 1 demo USDC. Funds outside
        escrow are paid at auction settlement. All times are in your local timezone.
      </div>
      <p className="mp-muted">Included: {asset.draft.campaign.deliverables}</p>
      {error && (
        <p className="mp-error" role="alert">
          {error}
        </p>
      )}
      <button className="mp-button primary full" type="submit">
        Review auction <ArrowRight size={17} />
      </button>
    </form>
  );
}

export function BiddingPanel({
  asset,
  campaign: c,
  artwork,
  onCreate,
  onProof,
  canCreate = true,
}: {
  asset: MarketAsset;
  campaign?: CampaignRecord;
  artwork?: Artwork;
  onCreate: () => void;
  onProof: () => void;
  canCreate?: boolean;
}) {
  const { state, transact } = useMarket(),
    [amount, setAmount] = useState<string | null>(null);
  if (!state) return null;
  const user = state.people.find((p) => p.id === state.current),
    own = user?.id === asset.owner,
    credit = state.credits[state.current ?? ''] ?? 0;
  if (!c)
    return (
      <section className="mp-box">
        <h2>No active auction</h2>
        <p className="mp-muted">
          This slot is published, but its creator has not opened an auction yet. Bidding opens when
          a campaign is scheduled.
        </p>
        {own && canCreate && (
          <AccessButton verified onClick={onCreate}>
            Create auction
          </AccessButton>
        )}
      </section>
    );
  const bid = topBid(c),
    min = minimumBid(c),
    input = amount ?? String(min / 1000000),
    value = amountOrZero(input),
    live = c.status === 'open' && state.now >= c.opens && state.now < c.closes,
    won = bid?.user === state.current;
  return (
    <div className="mp-stack">
      <section className="mp-box">
        <div className="mp-section-heading">
          <h2>{asset.draft.spots.find((s) => s.id === c.slotId)?.name}</h2>
          <Badge tone={live ? 'green' : 'amber'}>{campaignStatus(c, state.now)}</Badge>
        </div>
        <span className="mp-muted">
          {bid ? (c.status === 'open' ? 'Highest bid' : 'Winning bid') : 'No bids yet'}
        </span>
        <div className="mp-big-number">
          {display(bid?.amount ?? 0)}
          <small>USDC</small>
        </div>
        <Rows
          rows={[
            ['Bidding closes', dateLabel(c.closes)],
            ['Display period', `${dateLabel(c.start)} → ${dateLabel(c.end)}`],
            ['Held until proof', `${c.escrowPercent / 100}%`],
          ]}
        />
        {live && !own && (
          <>
            <label className="mp-field">
              Your bid (USDC)
              <input
                aria-label="Your bid in USDC"
                type="number"
                min={min / 1000000}
                step="0.000001"
                value={input}
                onChange={(e) => setAmount(e.target.value)}
              />
              <small>
                Minimum {display(min, 6)} USDC · {c.increment / 100}% bid increase
                {user && ` · Balance ${display(user.usdc)} USDC`}
              </small>
            </label>
            {user && value > user.usdc && (
              <p className="mp-error" role="alert">
                Insufficient USDC balance.
              </p>
            )}
            <SpendButton
              verified
              scope="auction"
              amount={value}
              disabled={!artwork || value < min || (!!user && value > user.usdc)}
              onReady={() =>
                transact(
                  'Place bid',
                  `Deposit ${display(value, 6)} USDC for this bid. If outbid, you can withdraw the full amount.`,
                  { type: 'bid', campaignId: c.id, amount: value, artwork: artwork! },
                  () => setAmount(null),
                )
              }
            >
              Review bid
            </SpendButton>
            {!artwork && (
              <p className="mp-small mp-muted">Add your logo in the preview above to bid.</p>
            )}
            <p className="mp-small mp-muted">
              Winning artwork becomes public when the auction is finalized.
            </p>
          </>
        )}
        {live && own && <p className="mp-muted">Your auction is open for bids.</p>}
        {c.status === 'open' && state.now < c.opens && (
          <p className="mp-muted">Bidding opens {dateLabel(c.opens)}.</p>
        )}
        {c.status === 'open' && state.now >= c.closes && (
          <AccessButton
            onClick={() =>
              transact(
                'Finalize auction',
                bid
                  ? `Record the winner and release the upfront portion of ${display(bid.amount)} USDC. The remainder stays in campaign escrow.`
                  : 'Close this campaign with no sale and no payment.',
                { type: 'finalize', campaignId: c.id },
              )
            }
          >
            Finalize auction
          </AccessButton>
        )}
        {c.status === 'booked' && (
          <>
            <div className="mp-note green">
              <CheckCircle2 size={18} />
              <span>{won ? 'You won this placement.' : 'This placement is booked.'}</span>
            </div>
            <Rows
              rows={[
                ['Paid to creator', `${display(c.creatorPaid, 6)} USDC`],
                ['Paid to asset vault', `${display(c.vaultPaid, 6)} USDC`],
                ['Held escrow', `${display(c.held, 6)} USDC`],
              ]}
            />
            {won && c.artworkPermission && (
              <>
                <AccessButton
                  disabled={!artwork}
                  onClick={() =>
                    transact(
                      'Update artwork',
                      'Replace the artwork on this placement. Fulfillment proof is checked against the original winning artwork.',
                      { type: 'artwork', campaignId: c.id, artwork: artwork! },
                    )
                  }
                >
                  Update artwork
                </AccessButton>
              </>
            )}
            {state.now >= c.end && own && (
              <button className="mp-button primary full" onClick={onProof}>
                {c.held ? (c.proof ? 'View proof' : 'Submit proof') : 'Complete campaign'}
              </button>
            )}
          </>
        )}
        {['completed', 'refunded', 'no-sale'].includes(c.status) && (
          <>
            <div className="mp-note green">
              {c.status === 'no-sale'
                ? 'No sale. No funds were taken.'
                : c.status === 'refunded'
                  ? 'Held escrow refunded. Previously released payments are unchanged.'
                  : 'Campaign completed. All payments settled.'}
            </div>
            <Rows
              rows={[
                ['Paid to creator', `${display(c.creatorPaid, 6)} USDC`],
                ['Paid to asset vault', `${display(c.vaultPaid, 6)} USDC`],
                ['Remaining escrow', `${display(c.held)} USDC`],
              ]}
            />
            {own && canCreate && (
              <AccessButton verified onClick={onCreate}>
                Create next campaign
              </AccessButton>
            )}
          </>
        )}
      </section>
      {credit > 0 && (
        <section className="mp-box">
          <Badge tone="amber">Outbid funds available</Badge>
          <h3>{display(credit)} USDC to withdraw</h3>
          <p className="mp-muted">Withdraw funds from bids that were outbid.</p>
          <AccessButton
            onClick={() =>
              transact('Withdraw outbid funds', `Return ${display(credit)} USDC to your wallet.`, {
                type: 'withdraw',
              })
            }
          >
            Withdraw {display(credit)} USDC
          </AccessButton>
        </section>
      )}
      {c.bids.length > 0 && (
        <section className="mp-box">
          <h3>Bid history</h3>
          <div className="mp-bid-history">
            {[...c.bids].reverse().map((b, i) => (
              <div key={`${b.at}-${i}`}>
                <span>
                  {state.people.find((p) => p.id === b.user)?.name ?? b.user}
                  {i === 0 && <Badge tone="green">Highest</Badge>}
                </span>
                <strong>{display(b.amount, 6)} USDC</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ProofPanel({
  campaign: c,
  close,
}: {
  campaign: CampaignRecord;
  close: () => void;
}) {
  const { state, transact } = useMarket(),
    [proof, setProof] = useState<Artwork | undefined>(c.proof);
  if (!state) return null;
  const winner = topBid(c);
  return (
    <div className="mp-stack">
      <p className="mp-muted">
        {c.held
          ? 'Upload a photo showing the winning artwork on the booked placement.'
          : 'All payments have been released. Complete the campaign to close artwork updates.'}
      </p>
      {winner && (
        <div className="mp-original-art">
          <img src={winner.artwork.url} alt="Original winning artwork" />
          <div>
            <strong>Original winning artwork</strong>
            <small>{winner.artwork.name}</small>
          </div>
        </div>
      )}
      <Rows
        rows={[
          ['Display ended', dateLabel(c.end)],
          ['Held escrow', `${display(c.held, 6)} USDC`],
        ]}
      />
      {c.held > 0 && c.proofResult !== 'match' && c.proofResult !== 'pending' && (
        <>
          <MediaInput proof value={proof} onChange={setProof} />
          <AccessButton
            disabled={!proof}
            onClick={() =>
              transact(
                'Submit proof',
                'Send this photo for review. Payment remains held until the proof is accepted.',
                { type: 'proof', campaignId: c.id, proof: proof! },
              )
            }
          >
            {c.proofResult === 'inconclusive' ? 'Resubmit proof' : 'Submit proof'}
          </AccessButton>
        </>
      )}
      {c.proofResult && (
        <div className={`mp-note ${c.proofResult === 'match' ? 'green' : ''}`} role="status">
          {c.proofResult === 'match'
            ? 'Proof accepted. You can release the held payment.'
            : c.proofResult === 'pending'
              ? 'Proof is under review. Payment remains held.'
              : 'Proof could not be verified. Upload a clearer photo.'}
        </div>
      )}
      {c.proof && (c.proofResult === 'pending' || c.proofResult === 'match') && (
        <img className="mp-proof-image" src={c.proof.url} alt="Submitted campaign proof" />
      )}
      {(c.proofResult === 'match' || c.held === 0) && (
        <AccessButton
          onClick={() =>
            transact(
              c.held ? 'Release payment' : 'Complete campaign',
              c.held
                ? `Release ${display(c.held, 6)} USDC according to the campaign’s payment terms and complete the campaign.`
                : 'Mark this campaign as complete and close artwork updates.',
              { type: 'release', campaignId: c.id },
              close,
            )
          }
        >
          {c.held ? `Release ${display(c.held, 6)} USDC` : 'Complete campaign'}
        </AccessButton>
      )}
    </div>
  );
}
