'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Coins } from 'lucide-react';
import { dateLabel, display, units, type Financing, type MarketAsset } from '@/lib/market';
import type { SwapQuote } from '@/lib/market-client';
import { useMarket } from './market-provider';
import { AccessButton, Badge, Rows, SpendButton } from './market-ui';

export function localDate(value: number) {
  const d = new Date(value);
  return new Date(value - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function amountOrZero(value: string) {
  try {
    return units(value);
  } catch {
    return 0;
  }
}
export function FinanceForm({ asset, close }: { asset: MarketAsset; close: () => void }) {
  const { state, transact } = useMarket(),
    [error, setError] = useState('');
  if (!state) return null;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        try {
          const data = new FormData(e.currentTarget),
            number = (key: string) => Number(data.get(key)),
            date = (key: string) => Date.parse(String(data.get(key)));
          const biddingBlocks = number('blocks'),
            closes = Date.now() + (biddingBlocks + 10) * 12000,
            start = date('start'),
            end = date('end');
          if (
            ![closes, start, end].every(Number.isFinite) ||
            closes <= state.now ||
            start <= closes ||
            end <= start
          ) {
            setError(
              'The sale must close in the future, before the revenue term starts. The term must end after it starts.',
            );
            return;
          }
          transact(
            'Launch token sale',
            `Create ${data.get('supply')} ${String(data.get('symbol')).toUpperCase()} tokens sharing ${number('percent')}% of eligible revenue from ${dateLabel(start)} to ${dateLabel(end)}. Minimum token price: ${data.get('floor')} USDC. Minimum raise: ${data.get('threshold')} USDC. Bidding lasts ${biddingBlocks} blocks. Allocation: 60% sale, 20% liquidity, 20% retained. Up to 20% of net sale funds supplies liquidity. You own the initial LP position. Protocol fees follow the deployed CCA configuration. These terms cannot be changed.`,
            {
              type: 'finance',
              assetId: asset.id,
              terms: {
                name: String(data.get('name')),
                symbol: String(data.get('symbol')).toUpperCase(),
                percent: Math.round(number('percent') * 100),
                totalSupply: units(String(data.get('supply'))),
                floor: units(String(data.get('floor'))),
                threshold: units(String(data.get('threshold'))),
                closes,
                biddingBlocks,
                start,
                end,
              },
            },
            close,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Check the financing terms.');
        }
      }}
    >
      <p className="mp-muted">
        Share advertising revenue from <strong>{asset.name}</strong> with token holders. These terms
        apply to new campaigns after activation.
      </p>
      <div className="mp-form-grid">
        <label>
          Token name
          <input name="name" defaultValue={`${asset.name} Revenue`} maxLength={80} required />
        </label>
        <label>
          Token symbol
          <input
            name="symbol"
            pattern="[A-Za-z][A-Za-z0-9]{1,7}"
            maxLength={8}
            title="Use 2–8 letters or numbers, starting with a letter."
            required
          />
        </label>
        <label>
          Fixed token supply
          <input name="supply" type="number" min="1" defaultValue="1000" required />
        </label>
        <label>
          Revenue share (%)
          <input
            name="percent"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            defaultValue="50"
            required
          />
        </label>
        <label>
          Minimum token price (USDC)
          <input
            name="floor"
            type="number"
            min="0.000001"
            step="0.000001"
            defaultValue="0.10"
            required
          />
        </label>
        <label>
          Minimum raise (USDC)
          <input
            name="threshold"
            type="number"
            min="1"
            step="0.000001"
            defaultValue="50"
            required
          />
        </label>
        <label>
          Bidding window (blocks)
          <input name="blocks" type="number" min="5" max="300" defaultValue="30" required />
        </label>
        <label>
          Revenue term starts
          <input
            name="start"
            type="datetime-local"
            min={localDate(state.now)}
            defaultValue={localDate(Date.now() + 30 * 60000)}
            required
          />
        </label>
        <label>
          Revenue term ends
          <input
            name="end"
            type="datetime-local"
            min={localDate(state.now)}
            defaultValue={localDate(Date.now() + 150 * 60000)}
            required
          />
        </label>
      </div>
      <div className="mp-note">
        Includes current and future placements. Existing campaigns keep their original terms. Times
        are in your local timezone.
      </div>
      <p className="mp-small mp-muted">
        60% of tokens go to the sale, 20% to liquidity, and 20% stay with you. Up to 20% of net sale
        funds supplies liquidity. You own and may withdraw the initial LP position. Bidding opens
        ten blocks after launch; claims and migration require later transactions. Financing is
        optional and uses Sepolia test assets.
      </p>
      {error && (
        <p className="mp-error" role="alert">
          {error}
        </p>
      )}
      <button className="mp-button primary full" type="submit">
        Review token sale <ArrowRight size={17} />
      </button>
    </form>
  );
}

export function RevenueTerms({
  asset,
  financing: f,
}: {
  asset: MarketAsset;
  financing: Financing;
}) {
  const { state } = useMarket();
  return (
    <section className="mp-box">
      <h2>Revenue terms</h2>
      <p className="mp-muted">
        {f.name} holders share advertising revenue collected by {asset.name} during the revenue
        term.
      </p>
      <Rows
        rows={[
          ['Revenue share', `${f.percent / 100}% of eligible revenue`],
          ['Placements covered', `${asset.draft.spots.length} current and all future placements`],
          ['Fixed supply', `${display(f.totalSupply, 0)} ${f.symbol}`],
          ['Sale allocation', `${display(f.saleSupply, 0)} ${f.symbol}`],
          ['Liquidity allocation', `${display(f.lpSupply, 0)} ${f.symbol}`],
          ['Revenue term', `${dateLabel(f.start)} → ${dateLabel(f.end)}`],
          [
            'Covered campaigns',
            String(state?.campaigns.filter((c) => c.series === f.id).length ?? 0),
          ],
        ]}
      />
      <p className="mp-small mp-muted">
        Revenue is available for redemption after the term ends and all covered campaigns settle.
      </p>
    </section>
  );
}

export function InvestmentPanel({ asset }: { asset: MarketAsset }) {
  const { state, transact } = useMarket(),
    [budget, setBudget] = useState(''),
    [maxPrice, setMaxPrice] = useState('');
  if (!state || !asset.financing) return null;
  const f = asset.financing,
    user = state.people.find((p) => p.id === state.current),
    own = user?.id === asset.owner;
  const unclaimed = f.bids.filter((b) => b.user === state.current && !b.claimed),
    myBudget = unclaimed.reduce((sum, b) => sum + b.budget, 0),
    tokens = unclaimed.reduce((sum, b) => sum + b.tokens, 0),
    refund = unclaimed.reduce((sum, b) => sum + b.budget - b.spent, 0);
  return (
    <div className="mp-stack">
      <section className="mp-box">
        <Badge tone={f.status === 'active' ? 'green' : 'amber'}>
          {
            {
              fundraising: f.saleEnded ? 'Sale ended' : f.saleStarted ? 'Sale open' : 'Scheduled',
              migration: 'Awaiting activation',
              active: 'Active',
              failed: 'Minimum raise not met',
              deadline: 'Activation deadline missed',
            }[f.status]
          }
        </Badge>
        <h2 className="mp-panel-title">
          {f.status === 'fundraising'
            ? `Bid for ${f.symbol}`
            : f.status === 'active'
              ? `${f.symbol} revenue`
              : 'Sale results'}
        </h2>
        {f.status === 'fundraising' ? (
          <>
            <Rows
              rows={[
                ['Minimum token price', `${display(f.floor, 6)} USDC`],
                ['Bidding blocks', `${f.startBlock} to ${f.endBlock} (current ${f.block})`],
                ['Clearing price', `${display(f.clearingPrice ?? 0, 6)} USDC/token`],
                ['Gross raised, checkpointed', `${display(f.gross)} USDC`],
                ['Minimum raise', `${display(f.threshold)} USDC`],
              ]}
            />
            {!f.saleEnded && f.saleStarted ? (
              <>
                <label className="mp-field">
                  Your budget (USDC)
                  <input
                    type="number"
                    min="1"
                    step="0.000001"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </label>
                <label className="mp-field">
                  Maximum price per token (USDC)
                  <input
                    type="number"
                    min={f.floor / 1000000}
                    step="0.000001"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </label>
                <SpendButton
                  scope={`sale:${asset.id}`}
                  amount={amountOrZero(budget)}
                  disabled={!amountOrZero(budget) || amountOrZero(maxPrice) < f.floor}
                  onReady={() =>
                    transact(
                      'Place token bid',
                      `Deposit ${budget} USDC at a maximum price of ${maxPrice} USDC per ${f.symbol}. Any unspent amount will be available to claim after the sale.`,
                      {
                        type: 'sale-bid',
                        assetId: asset.id,
                        budget: units(budget),
                        maxPrice: units(maxPrice),
                      },
                    )
                  }
                >
                  Review token bid
                </SpendButton>
                {myBudget > 0 && (
                  <p className="mp-success">Your reserved budget: {display(myBudget)} USDC</p>
                )}
              </>
            ) : !f.saleEnded ? (
              <p className="mp-muted">Bidding opens at block {f.startBlock}.</p>
            ) : (
              <AccessButton
                onClick={() =>
                  transact(
                    'Finalize sale',
                    'Settle the sale and make token allocations and unused funds available to claim.',
                    { type: 'sale-close', assetId: asset.id },
                  )
                }
              >
                Finalize sale
              </AccessButton>
            )}
          </>
        ) : (
          <>
            <Rows
              rows={[
                ['Gross raised', `${display(f.gross)} USDC`],
                ['Protocol fee', `${display(f.fee, 6)} USDC`],
                [
                  f.proceedsClaimed ? 'USDC committed to pool' : 'Liquidity funding estimate',
                  `${display(f.poolUsdc)} USDC`,
                ],
                [
                  f.proceedsClaimed ? 'Creator proceeds transferred' : 'Creator proceeds estimate',
                  `${display(f.net)} USDC`,
                ],
              ]}
            />
            {f.status === 'migration' && (
              <>
                <div className="mp-note">
                  Activate before {dateLabel(f.start)} to open trading and start revenue coverage.
                </div>
                {own && state.now < f.start ? (
                  <AccessButton
                    disabled={!f.migrationReady}
                    onClick={() =>
                      transact(
                        'Activate financing',
                        'Fund the trading pool and start revenue coverage for new campaigns.',
                        { type: 'activate', assetId: asset.id },
                      )
                    }
                  >
                    Activate financing
                  </AccessButton>
                ) : (
                  <p className="mp-muted">
                    {state.now >= f.start
                      ? 'The activation deadline has passed.'
                      : 'Awaiting activation by the creator.'}
                  </p>
                )}
              </>
            )}
            {f.status === 'failed' && (
              <div className="mp-note">
                The sale did not reach its minimum raise.
                {unclaimed.length > 0 && ' Claim your refund below.'}
              </div>
            )}
            {f.status === 'deadline' && (
              <div className="mp-note">
                The creator did not activate financing before the deadline. Review your allocation
                below.
              </div>
            )}
            {f.status === 'active' && (
              <>
                <Rows
                  rows={[
                    ['Accumulated revenue', `${display(f.vault)} USDC`],
                    ['Your tokens', `${display(f.holdings[state.current ?? ''] ?? 0)} ${f.symbol}`],
                  ]}
                />
                <Link className="mp-button full" href="/portfolio">
                  View holdings <ArrowRight size={17} />
                </Link>
              </>
            )}
          </>
        )}
      </section>
      {f.status !== 'fundraising' && unclaimed.length > 0 && (
        <section className="mp-box">
          <h3>{f.status === 'failed' ? 'Claim your refund' : 'Claim your allocation'}</h3>
          {f.allocationPending ? (
            <p className="mp-muted">
              Exit your bids to calculate allocations and return unspent budgets. A second
              transaction claims purchased tokens after the claim block.
            </p>
          ) : (
            <Rows
              rows={[
                ['Original budget', `${display(myBudget)} USDC`],
                ['Token allocation', `${display(tokens)} ${f.symbol}`],
                ['Unspent budget', `${display(refund)} USDC`],
              ]}
            />
          )}
          <AccessButton
            disabled={!f.saleEnded}
            onClick={() =>
              transact(
                f.status === 'failed' ? 'Claim sale refund' : 'Claim sale allocation',
                f.status === 'failed'
                  ? `Return ${display(refund)} USDC to your wallet.`
                  : `Receive ${display(tokens)} ${f.symbol} and ${display(refund)} USDC in unused funds.`,
                { type: 'sale-claim', assetId: asset.id },
                undefined,
              )
            }
          >
            {f.status === 'failed' ? 'Claim refund' : 'Claim tokens & refund'}
          </AccessButton>
        </section>
      )}
    </div>
  );
}

export function TradingPanel({ asset }: { asset: MarketAsset }) {
  const { state, transact, quoteSwap } = useMarket(),
    [side, setSide] = useState<'buy' | 'sell'>('buy'),
    [amount, setAmount] = useState(''),
    [slippage, setSlippage] = useState('0.5'),
    [quoteResult, setQuoteResult] = useState<{ key: string; data: SwapQuote } | null>(null),
    [quoteError, setQuoteError] = useState<{ key: string; message: string } | null>(null),
    [pendingKey, setPendingKey] = useState(''),
    [refresh, setRefresh] = useState(0);
  const f = asset.financing,
    user = state?.people.find((p) => p.id === state.current),
    value = amountOrZero(amount),
    slip = Number(slippage),
    valid = slippage.trim() !== '' && Number.isFinite(slip) && slip >= 0 && slip <= 5,
    slippageBps = Math.round(slip * 100),
    tradeOpen = !!f && f.status === 'active' && !!state && state.now < f.end,
    requestKey = `${asset.id}:${state?.current ?? ''}:${side}:${value}:${slippageBps}:${refresh}`,
    quote = quoteResult?.key === requestKey ? quoteResult.data : null,
    error = quoteError?.key === requestKey ? quoteError.message : '',
    pending = pendingKey === requestKey,
    expired = !!quote && quote.expires <= (state?.now ?? Date.now());

  useEffect(() => {
    if (!tradeOpen || !value || !valid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setPendingKey(requestKey);
      setQuoteError(null);
      void quoteSwap({ assetId: asset.id, side, amount: value, slippageBps })
        .then((data) => {
          if (!cancelled) setQuoteResult({ key: requestKey, data });
        })
        .catch((err: unknown) => {
          if (!cancelled)
            setQuoteError({
              key: requestKey,
              message: err instanceof Error ? err.message : 'Unable to load a price. Try again.',
            });
        })
        .finally(() => {
          if (!cancelled) setPendingKey('');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [asset.id, side, value, slippageBps, valid, tradeOpen, requestKey, quoteSwap]);

  if (!state || !f) return null;
  if (f.status !== 'active')
    return (
      <section className="mp-box">
        <Coins />
        <h3>Trading is not open</h3>
        <p className="mp-muted">Trading opens when financing is activated.</p>
      </section>
    );
  if (state.now >= f.end)
    return (
      <section className="mp-box">
        <h3>Revenue term ended</h3>
        <p className="mp-muted">Check your tokens and redemption status in Portfolio.</p>
        <Link className="mp-button full" href="/portfolio">
          View redemption
        </Link>
      </section>
    );
  const review = () => {
    if (!quote || quote.expires <= state.now) {
      setRefresh((current) => current + 1);
      return;
    }
    transact(
      `Review ${side === 'buy' ? 'purchase' : 'sale'}`,
      `Pay ${amount} ${side === 'buy' ? 'USDC' : f.symbol}. Receive at least ${display(quote.minimum, 6)} ${side === 'buy' ? f.symbol : 'USDC'}.`,
      {
        type: 'swap',
        assetId: asset.id,
        side,
        amount: value,
        minimum: quote.minimum,
        expires: quote.expires,
        quoteId: quote.id,
      },
      () => {
        setAmount('');
        setQuoteResult(null);
      },
    );
  };
  const balance = side === 'buy' ? (user?.usdc ?? 0) : (f.holdings[user?.id ?? ''] ?? 0),
    insufficient = !!user && value > balance,
    ready =
      !!quote && quote.minimum > 0 && value > 0 && valid && !expired && !pending && !insufficient;
  return (
    <section className="mp-box">
      <div className="mp-section-heading">
        <h2>{f.symbol} / USDC</h2>
      </div>
      <div className="mp-tabs mp-trade-tabs">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            className={side === s ? 'active' : ''}
            aria-pressed={side === s}
            onClick={() => {
              setSide(s);
              setAmount('');
            }}
          >
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>
      <label className="mp-amount">
        You pay{' '}
        <span>
          Balance {display(balance, 6)} {side === 'buy' ? 'USDC' : f.symbol}
        </span>
        <div>
          <input
            aria-label="Trade amount"
            type="number"
            min="0.000001"
            step="0.000001"
            value={amount}
            placeholder="0"
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
          />
          <strong>{side === 'buy' ? 'USDC' : f.symbol}</strong>
        </div>
      </label>
      <div className="mp-swap-arrow">
        <ArrowDown size={19} />
      </div>
      <div className="mp-amount" aria-live="polite" aria-busy={pending}>
        You receive · estimated
        <div>
          <strong>{quote ? display(quote.received, 6) : '—'}</strong>
          <span>{side === 'buy' ? f.symbol : 'USDC'}</span>
        </div>
      </div>
      <details className="mp-trade-settings">
        <summary>Slippage limit: {valid ? `${slippage}%` : 'Set limit'}</summary>
        <label className="mp-field">
          Maximum slippage (%)
          <input
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
          />
        </label>
      </details>
      {quote && (
        <Rows
          rows={[
            ['Trading fee', `${display(quote.fee, 6)} ${side === 'buy' ? 'USDC' : f.symbol}`],
            ['Price impact', `${quote.impact.toFixed(2)}%`],
            [
              'Minimum received',
              `${display(quote.minimum, 6)} ${side === 'buy' ? f.symbol : 'USDC'}`,
            ],
          ]}
        />
      )}
      {pending && (
        <p className="mp-muted" role="status">
          Getting a quote…
        </p>
      )}
      {!valid && (
        <p className="mp-error" role="alert">
          Choose slippage between 0% and 5%.
        </p>
      )}
      {insufficient && (
        <p className="mp-error" role="alert">
          Insufficient {side === 'buy' ? 'USDC' : f.symbol} balance.
        </p>
      )}
      {error && (
        <p className="mp-error" role="alert">
          {error}
        </p>
      )}
      {(expired || error) && (
        <button className="mp-button full" onClick={() => setRefresh((current) => current + 1)}>
          Refresh quote
        </button>
      )}
      {side === 'buy' ? (
        <SpendButton amount={value} scope={`trade:${asset.id}`} disabled={!ready} onReady={review}>
          Review purchase
        </SpendButton>
      ) : (
        <AccessButton disabled={!ready} onClick={review}>
          Review sale
        </AccessButton>
      )}
      <div className="mp-note">
        Tokens carry the right to their share of collected and future campaign revenue. Selling
        transfers that right to the buyer.
      </div>
    </section>
  );
}
