'use client';
import { ConfirmedActionRefreshError, reportProgress } from './progress';
import { erc20Abi, formatUnits, type Address, type EIP1193Provider } from 'viem';
import type { MarketAction, MarketState, Artwork, Receipt } from '@/lib/market';
import {
  assertCanConfirm,
  type MarketClient,
  type SwapRequest,
  type SwapQuote,
} from '@/lib/market-client';
import { contracts, marketplaceChain } from './config';
import { universalRouter, permit2Abi, type TradeQuote } from './uniswap';
import { priceQ96 } from './math';
import type { ProofResult } from './domain';
import type { MarketSnapshot } from './snapshot';
import { mapMarketState, uiAmount } from './market-state';
import * as liveChain from './client';

export interface MarketWallet {
  address(): Address | undefined;
  provider(): Promise<EIP1193Provider>;
  connect(change?: boolean): Promise<void>;
  disconnect(): Promise<void>;
  switchNetwork(): Promise<void>;
  verify(): Promise<void>;
  authenticate(): Promise<liveChain.WalletSession>;
  session(): liveChain.WalletSession | undefined;
}
function rawAmount(value: number, decimals = 6) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Enter a valid positive amount.');
  return BigInt(value) * 10n ** BigInt(decimals - 6);
}
function decimal(value: number) {
  return formatUnits(rawAmount(value), 6);
}
function seconds(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error('Enter a valid date.');
  return BigInt(Math.floor(value / 1000));
}
export function createMarketAdapter(wallet: MarketWallet, chain = liveChain): MarketClient {
  let snapshot: MarketSnapshot | undefined;
  const listeners = new Set<() => void>();
  const quotes = new Map<
    string,
    { request: SwapRequest; account: string | null; quote: TradeQuote; view: SwapQuote }
  >();
  const receipts: Receipt[] = [];
  let completed: { key: string; message: string } | undefined;
  async function getState(): Promise<MarketState> {
    const account = wallet.address();
    const next = await chain.api<MarketSnapshot>(`/state${account ? `?wallet=${account}` : ''}`);
    if (account?.toLowerCase() !== wallet.address()?.toLowerCase()) return getState();
    snapshot = next;
    const state = mapMarketState(next);
    const provider = account ? await wallet.provider() : undefined;
    const chainId = provider
      ? Number(await provider.request({ method: 'eth_chainId' }))
      : marketplaceChain.id;
    state.network = chainId === marketplaceChain.id ? 'supported' : 'unsupported';
    state.networkName = chainId === marketplaceChain.id ? 'Ethereum Sepolia' : `Chain ${chainId}`;
    state.receipts = [...receipts];
    const session = wallet.session();
    if (
      session &&
      session.wallet.toLowerCase() === state.current &&
      session.expires > Date.now() / 1000
    ) {
      for (const c of state.campaigns) {
        const asset = state.assets.find((a) => a.id === c.assetId)!;
        if (
          asset.owner !== state.current &&
          !next.wallet?.admin &&
          c.bids.at(-1)?.user !== state.current
        )
          continue;
        const { proof } = await chain.api<{ proof: ProofResult | null }>(
          `/campaigns/${c.id}/proof`,
          undefined,
          session,
        );
        if (proof) {
          c.proof = { url: proof.photoURI, hash: proof.photoHash, name: 'Proof photo' };
          c.proofResult =
            proof.outcome === 'match' &&
            proof.authorization &&
            proof.authorization.deadline > Date.now() / 1000
              ? 'match'
              : 'inconclusive';
        }
      }
    }
    return state;
  }
  async function media(artwork: Artwork) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(artwork.url))
      throw new Error('Upload a new PNG, JPG or WebP image.');
    const blob = await (await fetch(artwork.url)).blob();
    if (blob.size > 2 * 1024 * 1024) throw new Error('Use an image smaller than 2 MB.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(
      '',
    );
    if (hash !== artwork.hash) throw new Error('The image changed. Upload it again.');
    return blob;
  }
  async function approve(token: Address, spender: Address, amount: bigint, account: Address) {
    const [ercAllowance, permitted] = await Promise.all([
      chain.browserPublicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, contracts.permit2],
      }),
      chain.browserPublicClient.readContract({
        address: contracts.permit2,
        abi: permit2Abi,
        functionName: 'allowance',
        args: [account, token, spender],
      }),
    ]);
    if (ercAllowance < amount) await chain.approvePermit2Token(account, token, amount);
    if (permitted[0] < amount || permitted[1] <= BigInt(Math.floor(Date.now() / 1000) + 300))
      await chain.approvePermit2Spender(account, token, spender, amount);
  }
  return {
    getState,
    subscribe(listener) {
      listeners.add(listener);
      window.addEventListener('placed-wallet-change', listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('placed-wallet-change', listener);
      };
    },
    async connect() {
      await wallet.connect();
      return getState();
    },
    async changeWallet() {
      await wallet.connect(true);
      quotes.clear();
      return getState();
    },
    async disconnect() {
      await wallet.disconnect();
      quotes.clear();
      snapshot = undefined;
      return getState();
    },
    async switchNetwork() {
      await wallet.switchNetwork();
      return getState();
    },
    async verify() {
      await wallet.verify();
      return getState();
    },
    async quoteSwap(request) {
      if (
        !Number.isInteger(request.slippageBps) ||
        request.slippageBps < 1 ||
        request.slippageBps > 500
      )
        throw new Error('Choose slippage between 0.01% and 5%.');
      const account = wallet.address()?.toLowerCase() ?? null;
      const query = new URLSearchParams({
        side: request.side,
        amount: decimal(request.amount),
        slippageBps: String(request.slippageBps),
      });
      const quote = await chain.api<TradeQuote>(`/assets/${request.assetId}/quote?${query}`);
      const outputDecimals = request.side === 'buy' ? 18 : 6;
      const view = {
        id: crypto.randomUUID(),
        received: uiAmount(quote.amountOut, outputDecimals),
        minimum: uiAmount(quote.minimumOut, outputDecimals),
        fee: uiAmount((rawAmount(request.amount) * BigInt(quote.feePips)) / 1_000_000n),
        impact: quote.priceImpactBps / 100,
        expires: quote.deadline * 1000,
      };
      for (const [id, saved] of quotes) if (saved.view.expires <= Date.now()) quotes.delete(id);
      quotes.set(view.id, { request, account, quote, view });
      return view;
    },
    async execute(action: MarketAction, accountId: string) {
      const latest = await getState();
      const key = JSON.stringify([accountId, action]);
      if (completed?.key === key) {
        const result = { state: latest, message: completed.message };
        completed = undefined;
        return result;
      }
      assertCanConfirm(latest, action, accountId);
      const account = wallet.address()!;
      const current = snapshot!;
      const asset =
        'assetId' in action ? current.assets.find((a) => a.id === action.assetId) : undefined;
      const campaign =
        'campaignId' in action
          ? current.campaigns.find((c) => c.id === action.campaignId)
          : undefined;
      const parent = campaign
        ? current.assets.find((a) => a.slots.some((s) => s.id === campaign.slotId))
        : undefined;
      let result: unknown;
      switch (action.type) {
        case 'faucet':
          result = await chain.faucet(account);
          break;
        case 'approve': {
          const amount = rawAmount(action.amount);
          if (action.scope === 'auction') result = await chain.approveAdvertising(account, amount);
          else {
            const [type, id] = action.scope.split(':');
            const series = current.assets.find((a) => a.id === id)?.financing;
            if (!series || !['sale', 'trade'].includes(type))
              throw new Error('Unknown spending permission.');
            await approve(
              contracts.usdc,
              type === 'sale' ? series.auction : universalRouter,
              amount,
              account,
            );
          }
          break;
        }
        case 'publish': {
          if (!current.wallet?.authorized)
            throw new Error('Verify your identity before publishing.');
          if (!action.draft.spots.length) throw new Error('Add an ad placement in Studio first.');
          const session = await wallet.authenticate();
          const stored = await chain.storeMetadata(session, 'asset', {
            version: 1,
            title: action.name,
            description: action.description,
            kind: action.draft.asset,
            modelUrl: action.draft.assetUrl,
            humanPreset: action.draft.humanPreset,
            color: action.draft.color,
            photos: [],
          });
          let existing = current.assets.find(
            (a) => a.creator.wallet.toLowerCase() === accountId && a.metadataURI === stored.uri,
          );
          const id = existing?.id ?? (await chain.publishAsset(account, stored.uri));
          for (const spot of action.draft.spots) {
            const slot = await chain.storeMetadata(session, 'slot', {
              version: 1,
              name: spot.name,
              placement: { ...spot, price: 0, artwork: undefined },
            });
            existing = await chain.api(`/assets/${id}`);
            if (!existing!.slots.some((s) => s.metadataURI === slot.uri))
              await chain.createSlot(account, id, slot.uri);
          }
          break;
        }
        case 'campaign': {
          const terms = action.terms;
          const owner = current.assets.find((a) => a.id === terms.assetId);
          if (
            owner?.creator.wallet.toLowerCase() !== accountId ||
            !owner.slots.some((s) => s.id === terms.slotId)
          )
            throw new Error('Choose one of your asset’s slots.');
          if (terms.startingBid !== 1_000_000)
            throw new Error('The first bid is at least 1 demo USDC.');
          result = await chain.createCampaign(account, terms.slotId, {
            bidStart: seconds(terms.opens),
            bidEnd: seconds(terms.closes),
            displayStart: seconds(terms.start),
            displayEnd: seconds(terms.end),
            minIncreaseBps: terms.increment,
            escrowBps: terms.escrowPercent,
          });
          break;
        }
        case 'bid': {
          if (!campaign || parent?.creator.wallet.toLowerCase() === accountId)
            throw new Error('You cannot bid on your own advertising slot.');
          const stored = await chain.uploadMedia(
            await wallet.authenticate(),
            await media(action.artwork),
          );
          result = await chain.placeAdvertisingBid(
            account,
            campaign.id,
            rawAmount(action.amount),
            stored,
          );
          break;
        }
        case 'withdraw':
          result = await chain.withdrawOutbid(account);
          break;
        case 'finalize':
          result = await chain.finalizeCampaign(account, action.campaignId);
          break;
        case 'artwork': {
          const slot = parent?.slots.find((s) => s.id === campaign?.slotId);
          if (
            !slot ||
            campaign?.bidder?.toLowerCase() !== accountId ||
            campaign.state !== 'displaying'
          )
            throw new Error('Only the current auction winner can update artwork.');
          const stored = await chain.uploadMedia(
            await wallet.authenticate(),
            await media(action.artwork),
          );
          result = await chain.setSlotArtwork(account, slot.resolver, slot.dnsName, stored.uri);
          break;
        }
        case 'proof': {
          const blob = await media(action.proof);
          result = await chain.api<ProofResult>(
            `/campaigns/${action.campaignId}/proof`,
            { method: 'POST', headers: { 'content-type': blob.type }, body: blob },
            await wallet.authenticate(),
          );
          break;
        }
        case 'release': {
          if (!campaign) throw new Error('Campaign not found.');
          if (campaign.held === '0') result = await chain.completeZeroEscrow(account, campaign.id);
          else {
            const response = await chain.api<{ proof: ProofResult | null }>(
              `/campaigns/${campaign.id}/proof`,
              undefined,
              await wallet.authenticate(),
            );
            if (
              !response.proof?.authorization ||
              response.proof.authorization.deadline <= Date.now() / 1000
            )
              throw new Error('Submit a fresh matching proof before releasing escrow.');
            result = await chain.releaseEscrow(account, response.proof.authorization);
          }
          break;
        }
        case 'refund':
          result = await chain.refundEscrow(account, action.campaignId);
          break;
        case 'finance': {
          if (!asset || asset.creator.wallet.toLowerCase() !== accountId || asset.financing)
            throw new Error('Financing is available once for your own asset.');
          const t = action.terms,
            block = await chain.browserPublicClient.getBlock();
          const window = t.biddingBlocks ?? 30;
          if (!Number.isInteger(window) || window < 5 || window > 300)
            throw new Error('Choose 5 to 300 sale blocks.');
          if (seconds(t.start) <= block.timestamp + BigInt((window + 20) * 12))
            throw new Error(
              'Leave time for bidding, claims and migration before the revenue term.',
            );
          const totalSupply = rawAmount(t.totalSupply, 18),
            startBlock = block.number + 10n,
            endBlock = startBlock + BigInt(window),
            floor = priceQ96(decimal(t.floor));
          result = await chain.raiseCapital(
            account,
            asset.id,
            {
              name: t.name,
              symbol: t.symbol,
              revenueBps: t.percent,
              totalSupply,
              termStart: seconds(t.start),
              termEnd: seconds(t.end),
            },
            {
              auctionSupply: (totalSupply * 60n) / 100n,
              liquiditySupply: (totalSupply * 20n) / 100n,
              liquidityCurrencyMps: 2_000_000,
              startBlock,
              endBlock,
              claimBlock: endBlock + 1n,
              migrationBlock: endBlock + 2n,
              floorPrice: floor,
              priceTickSpacing: floor,
              minimumRaise: rawAmount(t.threshold),
            },
          );
          break;
        }
        case 'sale-bid': {
          if (!asset?.financing) throw new Error('This asset has no token sale.');
          const sale = current.launches[asset.id],
            floor = BigInt(sale.floorPrice),
            tick = BigInt(sale.tickSpacing),
            requested = priceQ96(decimal(action.maxPrice));
          if (requested < floor) throw new Error('Maximum price is below the sale floor.');
          const price = floor + ((requested - floor) / tick) * tick;
          if (price <= BigInt(sale.clearingPrice))
            throw new Error('Your price limit must exceed the current clearing price.');
          result = await chain.submitCCABid(
            account,
            asset.financing.auction,
            price,
            rawAmount(action.budget),
          );
          break;
        }
        case 'sale-close': {
          if (!asset?.financing) throw new Error('Token sale not found.');
          result = await chain.checkpointCCA(account, asset.financing.auction);
          break;
        }
        case 'sale-claim': {
          if (!asset?.financing) throw new Error('Token sale not found.');
          let sale = current.launches[asset.id];
          if (BigInt(sale.block) < BigInt(sale.endBlock))
            throw new Error('The sale has not ended.');
          if (BigInt(sale.checkpointBlock) < BigInt(sale.endBlock))
            await chain.checkpointCCA(account, asset.financing.auction);
          sale = await chain.api(`/assets/${asset.id}/launch?wallet=${account}`);
          for (const bid of sale.bids) {
            if (!bid.exited)
              result = bid.hints
                ? await chain.exitPartialCCABid(
                    account,
                    asset.financing.auction,
                    bid.id,
                    BigInt(bid.hints.last),
                    BigInt(bid.hints.outbid),
                  )
                : await chain.exitCCABid(account, asset.financing.auction, bid.id);
          }
          sale = await chain.api(`/assets/${asset.id}/launch?wallet=${account}`);
          if (BigInt(sale.block) < BigInt(sale.claimBlock))
            throw new Error(
              'Unspent funds returned. Token claims open at the claim block; return to finish.',
            );
          for (const bid of sale.bids)
            if (!bid.claimed && bid.exited && BigInt(bid.tokensFilled) > 0n)
              result = await chain.claimCCATokens(account, asset.financing.auction, bid.id);
          break;
        }
        case 'activate': {
          if (!asset?.financing) throw new Error('Financing not found.');
          if (asset.financing.migrationAttempted)
            throw new Error(
              'Migration was already attempted. Review the confirmed LP position before recovery.',
            );
          result = await chain.migrateLaunch(account, asset.id);
          break;
        }
        case 'load-proofs': {
          if (!current.wallet?.admin)
            throw new Error('Admin access is required to review proof photos.');
          await wallet.authenticate();
          break;
        }
        case 'redeem': {
          if (!asset?.financing) throw new Error('Revenue token not found.');
          const balance = current.wallet!.tokens[asset.id];
          result = await chain.redeemShares(account, asset.financing.token, BigInt(balance));
          break;
        }
        case 'swap': {
          const saved = quotes.get(action.quoteId);
          if (
            !saved ||
            saved.account !== accountId ||
            saved.request.assetId !== action.assetId ||
            saved.request.side !== action.side ||
            saved.request.amount !== action.amount ||
            saved.view.minimum !== action.minimum ||
            saved.view.expires !== action.expires ||
            Date.now() >= action.expires
          )
            throw new Error('This trade review is stale. Request a fresh quote.');
          await approve(
            saved.quote.inputToken,
            universalRouter,
            BigInt(saved.quote.amountIn),
            account,
          );
          if (Date.now() >= action.expires)
            throw new Error('Approval confirmed, but the quote expired. Request a fresh quote.');
          result = await chain.executeTrade(account, saved.quote);
          quotes.delete(action.quoteId);
          break;
        }
      }
      const message =
        action.type === 'proof' && result && typeof result === 'object' && 'explanation' in result
          ? String(result.explanation)
          : action.type === 'load-proofs'
            ? 'Proof photos loaded.'
            : 'Confirmed on Sepolia.';
      if (result && typeof result === 'object' && 'transactionHash' in result)
        receipts.push({
          id: String(result.transactionHash),
          at: Date.now(),
          user: accountId,
          title: action.type === 'faucet' ? 'Demo USDC received' : `${action.type} confirmed`,
        });
      completed = { key, message };
      reportProgress({
        phase: 'refreshing',
        label: 'Updating your asset and balances',
        ...(result && typeof result === 'object' && 'transactionHash' in result
          ? { hash: String(result.transactionHash) }
          : {}),
      });
      let state: MarketState;
      try {
        state = await getState();
      } catch {
        throw new ConfirmedActionRefreshError(
          result && typeof result === 'object' && 'transactionHash' in result
            ? String(result.transactionHash)
            : undefined,
        );
      }
      completed = undefined;
      for (const listener of listeners) listener();
      return { state, message };
    },
  };
}
