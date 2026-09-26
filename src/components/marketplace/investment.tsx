'use client';
import { useEffect, useState } from 'react';
import { erc20Abi, parseUnits } from 'viem';
import type { Asset } from '@/lib/marketplace/domain';
import type { LaunchStatus } from '@/lib/marketplace/server/launch';
import type { TradeQuote } from '@/lib/marketplace/uniswap';
import { universalRouter } from '@/lib/marketplace/uniswap';
import * as client from '@/lib/marketplace/client';
import { contracts } from '@/lib/marketplace/config';
import { priceQ96, usdcAmount } from '@/lib/marketplace/math';
import { useMarketplace } from './context';
import { useRecord, Metrics, dollars, tokens, time, ErrorMessage } from './shared';
import { localDate } from './campaign-form';
import styles from './marketplace.module.css';

export function FinancingForm({ asset }: { asset: Asset }) {
  const market = useMarketplace();
  const [name, setName] = useState(`${asset.metadata?.title || 'Asset'} revenue`);
  const [symbol, setSymbol] = useState('PLACED');
  const [supply, setSupply] = useState('1000');
  const [share, setShare] = useState('50');
  const [floor, setFloor] = useState('0.10');
  const [minimum, setMinimum] = useState('50');
  const [blocks, setBlocks] = useState('30');
  const [start, setStart] = useState(() => localDate(Date.now() / 1000 + 30 * 60));
  const [end, setEnd] = useState(() => localDate(Date.now() / 1000 + 150 * 60));
  return (
    <section className={styles.panel}>
      <h2>Raise capital against this asset</h2>
      <p className={styles.warning}>
        Optional testnet financing. Terms become immutable. It covers future campaigns across every
        slot in this asset, including slots added later.
      </p>
      <label>
        Revenue token name
        <input value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className={styles.row}>
        <label>
          Symbol
          <input value={symbol} maxLength={16} onChange={(e) => setSymbol(e.target.value)} />
        </label>
        <label>
          Total fixed supply
          <input value={supply} inputMode="decimal" onChange={(e) => setSupply(e.target.value)} />
        </label>
      </div>
      <label>
        Share of released advertising revenue, %
        <input
          type="number"
          min=".01"
          max="100"
          step=".01"
          value={share}
          onChange={(e) => setShare(e.target.value)}
        />
      </label>
      <div className={styles.row}>
        <label>
          Revenue term starts
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Revenue term ends
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className={styles.row}>
        <label>
          CCA floor, USDC per token
          <input value={floor} onChange={(e) => setFloor(e.target.value)} />
        </label>
        <label>
          Minimum raise, USDC
          <input value={minimum} onChange={(e) => setMinimum(e.target.value)} />
        </label>
      </div>
      <label>
        CCA bidding window, blocks
        <input
          type="number"
          min="5"
          max="300"
          value={blocks}
          onChange={(e) => setBlocks(e.target.value)}
        />
      </label>
      <p>
        Allocation: 60% to CCA, 20% for liquidity, 20% retained by you. Up to 20% of net sale
        currency funds liquidity. You own the initial LP position and may withdraw it.
      </p>
      <p className={styles.muted}>
        The sale starts ten blocks after launch. Claims open one block after bidding ends; migration
        opens two blocks after bidding ends. Leave enough time before the fixed revenue term starts.
        All times are real, short demo terms.
      </p>
      <button
        disabled={market.busy || !market.wallet}
        onClick={() =>
          void market.run('Create asset revenue token and CCA launch', async () => {
            const totalSupply = parseUnits(supply, 18);
            const termStart = BigInt(Math.floor(new Date(start).getTime() / 1000));
            const termEnd = BigInt(Math.floor(new Date(end).getTime() / 1000));
            const window = Number(blocks);
            if (!Number.isInteger(window) || window < 5 || window > 300)
              throw Error('Choose a sale window from 5 to 300 blocks.');
            if (totalSupply <= 0n || totalSupply >= 2n ** 128n)
              throw Error('Invalid total supply.');
            const block = await client.browserPublicClient.getBlock();
            if (termStart <= block.timestamp + BigInt((window + 20) * 12))
              throw Error('The revenue term must leave time for bidding, claims and migration.');
            const startBlock = block.number + 10n;
            const endBlock = startBlock + BigInt(window);
            const floorPrice = priceQ96(floor);
            return client.raiseCapital(
              market.wallet!,
              asset.id,
              {
                name,
                symbol,
                totalSupply,
                revenueBps: Math.round(Number(share) * 100),
                termStart,
                termEnd,
              },
              {
                auctionSupply: (totalSupply * 60n) / 100n,
                liquiditySupply: (totalSupply * 20n) / 100n,
                liquidityCurrencyMps: 2_000_000,
                startBlock,
                endBlock,
                claimBlock: endBlock + 1n,
                migrationBlock: endBlock + 2n,
                floorPrice,
                priceTickSpacing: floorPrice,
                minimumRaise: usdcAmount(minimum),
              },
            );
          })
        }
      >
        Lock terms and launch financing
      </button>
    </section>
  );
}

export function InvestmentPanel({ asset }: { asset: Asset }) {
  const market = useMarketplace();
  const series = asset.financing!;
  const { record: sale, error } = useRecord<LaunchStatus>(
    `/assets/${asset.id}/launch${market.wallet ? `?wallet=${market.wallet}` : ''}`,
  );
  const [budget, setBudget] = useState('100');
  const [maxPrice, setMaxPrice] = useState('1.00');
  const [balance, setBalance] = useState('0');
  const [position, setPosition] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('1');
  const [quote, setQuote] = useState<TradeQuote>();
  useEffect(() => {
    setQuote(undefined);
  }, [amount, side, asset.id]);
  useEffect(() => {
    if (!market.wallet) {
      setBalance('0');
      return;
    }
    let active = true;
    client.browserPublicClient
      .readContract({
        address: series.token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [market.wallet],
      })
      .then((value) => {
        if (active) setBalance(String(value));
      });
    return () => {
      active = false;
    };
  }, [series.token, market.wallet, market.revision]);
  const saleStarted = sale && BigInt(sale.block) >= BigInt(sale.startBlock);
  const saleEnded = sale && BigInt(sale.block) >= BigInt(sale.endBlock);
  const checkpointed = sale && BigInt(sale.checkpointBlock) >= BigInt(sale.endBlock);
  return (
    <>
      <section className={styles.panel}>
        <h2>Invest in the asset’s revenue</h2>
        <Metrics
          items={[
            [`Share across all ${asset.slots.length} slots`, `${series.revenueBps / 100}%`],
            ['Fixed original supply', tokens(series.initialSupply)],
            ['Collected vault revenue', dollars(series.accountedRevenue)],
            ['Your token balance', tokens(balance)],
          ]}
        />
        <p>
          Term: {time(series.termStart)} to {time(series.termEnd)}
        </p>
        <p>
          Every token has identical rights. Transfers carry the claim to accumulated revenue and
          future covered receipts. No principal repayment, minimum return or interim dividends.
        </p>
        <p className={styles.muted}>
          Only USDC released from covered marketplace campaigns contributes. Off-platform
          sponsorships, token-sale proceeds and pool fees are excluded. Revenue tokens grant no
          artwork permissions or control over the creator or asset.
        </p>
        <p className={styles.code}>Token and vault: {series.token}</p>
        <Metrics
          items={[
            ['CCA token allocation', tokens(series.auctionSupply)],
            ['Liquidity token reserve', tokens(series.liquiditySupply)],
            [
              'Creator-retained tokens',
              tokens(
                BigInt(series.initialSupply) -
                  BigInt(series.auctionSupply) -
                  BigInt(series.liquiditySupply),
              ),
            ],
            ['Net currency for liquidity', `${series.liquidityCurrencyMps / 100000}%`],
          ]}
        />
        <p className={styles.code}>Initial LP owner: {series.liquidityOwner}</p>
        <p className={styles.warning}>
          The creator owns the initial LP and can withdraw it. A funded pool does not guarantee a
          buyer or profitable exit.
        </p>
      </section>
      <section className={styles.panel}>
        <h2>Uniswap CCA launch</h2>
        <ErrorMessage error={error} />
        {sale && (
          <>
            <p>
              Block {sale.block} · Bids {sale.startBlock} to {sale.endBlock} · Claims from{' '}
              {sale.claimBlock}
            </p>
            <Metrics
              items={[
                [
                  'Clearing price',
                  `${(Number(BigInt(sale.clearingPrice)) * 1e18) / (2 ** 96 * 1e6)} USDC/token`,
                ],
                ['Gross raised, checkpointed', dollars(sale.grossRaised)],
                ['Protocol fee at current config', dollars(sale.fee)],
                ['Minimum raise', dollars(sale.minimumRaise)],
                ['Liquidity currency estimate', dollars(sale.liquidityEstimate)],
                ['Creator proceeds estimate', dollars(sale.creatorProceedsEstimate)],
              ]}
            />
            <p className={styles.muted}>
              Estimates depend on the sale outcome, protocol fees and actual liquidity consumed at
              migration. Only transferred proceeds are spendable.
            </p>
            {sale.creatorProceeds !== undefined && (
              <Metrics
                items={[
                  ['Creator proceeds transferred', dollars(sale.creatorProceeds)],
                  ['USDC committed to the pool', dollars(sale.liquidityFunding!)],
                ]}
              />
            )}
            {!saleStarted && <p>Waiting for bidding to open.</p>}
            {saleStarted && !saleEnded && (
              <>
                <label>
                  USDC budget
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label>
                  Maximum USDC price per token
                  <input
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <p className={styles.muted}>
                  Your limit is rounded down to the nearest valid CCA price tick. CCA uses its own
                  clearing-price mechanism, separate from advertising bid increments.
                </p>
                <div className={styles.controls}>
                  <button
                    disabled={market.busy || !market.wallet}
                    onClick={() =>
                      void market.run('Approve USDC for Permit2', () =>
                        client.approvePermit2Token(
                          market.wallet!,
                          contracts.usdc,
                          usdcAmount(budget),
                        ),
                      )
                    }
                  >
                    1. Approve USDC
                  </button>
                  <button
                    disabled={market.busy || !market.wallet}
                    onClick={() =>
                      void market.run('Authorize CCA spending in Permit2', () =>
                        client.approvePermit2Spender(
                          market.wallet!,
                          contracts.usdc,
                          series.auction,
                          usdcAmount(budget),
                        ),
                      )
                    }
                  >
                    2. Allow CCA budget
                  </button>
                  <button
                    disabled={market.busy || !market.wallet}
                    onClick={() =>
                      void market.run('Submit CCA investment bid', () => {
                        const requested = priceQ96(maxPrice),
                          floor = BigInt(sale.floorPrice),
                          tick = BigInt(sale.tickSpacing);
                        if (requested < floor) throw Error('Maximum price is below the CCA floor.');
                        const price = floor + ((requested - floor) / tick) * tick;
                        if (price <= BigInt(sale.clearingPrice))
                          throw Error('Maximum price must exceed the current clearing price.');
                        return client.submitCCABid(
                          market.wallet!,
                          series.auction,
                          price,
                          usdcAmount(budget),
                        );
                      })
                    }
                  >
                    3. Submit budget and price limit
                  </button>
                </div>
              </>
            )}
            {saleEnded && (
              <>
                <button
                  disabled={market.busy || !market.wallet}
                  onClick={() =>
                    void market.run('Checkpoint final CCA outcome', () =>
                      client.checkpointCCA(market.wallet!, series.auction),
                    )
                  }
                >
                  Checkpoint sale
                </button>
                {market.wallet?.toLowerCase() === asset.creator.wallet.toLowerCase() &&
                  checkpointed &&
                  !sale.unsoldSwept && (
                    <button
                      disabled={market.busy}
                      onClick={() =>
                        void market.run('Collect unsold CCA token allocation', () =>
                          client.sweepUnsoldTokens(market.wallet!, series.auction),
                        )
                      }
                    >
                      Collect remaining auction tokens
                    </button>
                  )}
                <p>
                  {!checkpointed
                    ? 'Finalize the checkpoint to determine the sale outcome.'
                    : sale.graduated
                      ? 'The sale met its fundraising threshold. Claim allocations and migrate liquidity.'
                      : 'The sale missed its threshold. Exit your bids to recover the full budget; financing stays inactive.'}
                </p>
              </>
            )}
            {sale.bids.map((bid) => (
              <div key={bid.id}>
                <h3>Your bid #{bid.id}</h3>
                <p>
                  Budget {dollars(bid.budget)} ·{' '}
                  {bid.exited
                    ? `${tokens(bid.tokensFilled)} tokens ready to claim`
                    : 'Allocation pending exit'}
                </p>
                <div className={styles.controls}>
                  {!bid.exited && saleEnded && (
                    <button
                      disabled={market.busy || !market.wallet || !checkpointed}
                      onClick={() =>
                        void market.run('Exit CCA bid and return unspent budget', () =>
                          bid.hints
                            ? client.exitPartialCCABid(
                                market.wallet!,
                                series.auction,
                                bid.id,
                                BigInt(bid.hints.last),
                                BigInt(bid.hints.outbid),
                              )
                            : client.exitCCABid(market.wallet!, series.auction, bid.id),
                        )
                      }
                    >
                      Exit and recover unspent budget
                    </button>
                  )}
                  {bid.exited &&
                    BigInt(bid.tokensFilled) > 0n &&
                    BigInt(sale.block) >= BigInt(sale.claimBlock) && (
                      <button
                        disabled={market.busy || !market.wallet}
                        onClick={() =>
                          void market.run('Claim purchased revenue tokens', () =>
                            client.claimCCATokens(market.wallet!, series.auction, bid.id),
                          )
                        }
                      >
                        Claim tokens
                      </button>
                    )}
                </div>
              </div>
            ))}
            {!series.activated &&
              sale.graduated &&
              BigInt(sale.block) >= BigInt(series.migrationBlock) && (
                <>
                  <button
                    disabled={
                      market.busy ||
                      !market.wallet ||
                      series.migrationAttempted ||
                      Date.now() / 1000 >= series.termStart
                    }
                    onClick={() =>
                      void market.run('Migrate funded liquidity and activate financing', () =>
                        client.migrateLaunch(market.wallet!, asset.id),
                      )
                    }
                  >
                    Migrate to Uniswap v4
                  </button>
                  {sale.swept && (
                    <>
                      <label>
                        Existing migration LP position ID
                        <input value={position} onChange={(e) => setPosition(e.target.value)} />
                      </label>
                      <button
                        disabled={market.busy || !market.wallet || !/^\d+$/.test(position)}
                        onClick={() =>
                          void market.run('Verify existing migration and activate financing', () =>
                            client.activateMigratedLaunch(market.wallet!, asset.id, position),
                          )
                        }
                      >
                        Recognize migration performed directly
                      </button>
                    </>
                  )}
                </>
              )}
            {!series.activated && Date.now() / 1000 >= series.termStart && (
              <p className={styles.warning}>
                The activation deadline passed. New campaigns remain unfinanced. Recovery follows
                the underlying CCA and launch strategy rules; a stalled migration is not
                automatically refundable.
              </p>
            )}
          </>
        )}
      </section>
      {series.activated && (
        <section className={styles.panel}>
          <h2>Trade on Uniswap v4</h2>
          <div className={styles.controls}>
            <button
              className={side === 'buy' ? styles.active : undefined}
              onClick={() => setSide('buy')}
            >
              Buy shares
            </button>
            <button
              className={side === 'sell' ? styles.active : undefined}
              onClick={() => setSide('sell')}
            >
              Sell shares
            </button>
          </div>
          <label>
            {side === 'buy' ? 'USDC to spend' : 'Revenue tokens to sell'}
            <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button
            disabled={market.busy}
            onClick={() =>
              void market.run('Get executable v4 quote', async () => {
                const next = await client.api<TradeQuote>(
                  `/assets/${asset.id}/quote?side=${side}&amount=${encodeURIComponent(amount)}&slippageBps=50`,
                );
                setQuote(next);
              })
            }
          >
            Get quote
          </button>
          {quote && (
            <>
              <Metrics
                items={[
                  [
                    'Expected received',
                    side === 'buy' ? `${tokens(quote.amountOut)} tokens` : dollars(quote.amountOut),
                  ],
                  [
                    'Minimum received, 0.5% slippage',
                    side === 'buy'
                      ? `${tokens(quote.minimumOut)} tokens`
                      : dollars(quote.minimumOut),
                  ],
                  ['Pool fees', `${quote.feePips / 10000}%`],
                  ['Price impact excluding fees', `${quote.priceImpactBps / 100}%`],
                ]}
              />
              <p>Quote expires: {time(quote.deadline)}</p>
              <div className={styles.controls}>
                <button
                  disabled={market.busy || !market.wallet}
                  onClick={() =>
                    void market.run('Approve input token for Permit2', () =>
                      client.approvePermit2Token(
                        market.wallet!,
                        quote.inputToken,
                        BigInt(quote.amountIn),
                      ),
                    )
                  }
                >
                  1. Approve input
                </button>
                <button
                  disabled={market.busy || !market.wallet}
                  onClick={() =>
                    void market.run('Authorize router spending in Permit2', () =>
                      client.approvePermit2Spender(
                        market.wallet!,
                        quote.inputToken,
                        universalRouter,
                        BigInt(quote.amountIn),
                      ),
                    )
                  }
                >
                  2. Allow router
                </button>
                <button
                  disabled={market.busy || !market.wallet || quote.deadline <= Date.now() / 1000}
                  onClick={() =>
                    void market.run('Execute v4 swap', () =>
                      client.executeTrade(market.wallet!, quote),
                    )
                  }
                >
                  3. Swap
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
