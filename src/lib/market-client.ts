import type { MarketAction, MarketState } from './market';

export type SwapRequest = {
  assetId: string;
  side: 'buy' | 'sell';
  amount: number;
  slippageBps: number;
};
export type SwapQuote = {
  id: string;
  received: number;
  minimum: number;
  fee: number;
  impact: number;
  expires: number;
};
export type MarketResult = { state: MarketState; message: string };

export function assertCanConfirm(state: MarketState, action: MarketAction, accountId: string) {
  if (state.current !== accountId)
    throw new Error('Your wallet changed. Close this review and try again.');
  if (state.network !== 'supported')
    throw new Error('Switch to the supported network in your wallet.');
  if (action.type === 'swap' && state.now >= action.expires)
    throw new Error('This quote expired. Close this review to get a new quote.');
}

export function validateSwapQuote(quote: SwapQuote, now: number): SwapQuote {
  if (
    !quote.id ||
    ![quote.received, quote.minimum, quote.fee, quote.expires].every(Number.isSafeInteger) ||
    quote.minimum <= 0 ||
    quote.received < quote.minimum ||
    quote.fee < 0 ||
    !Number.isFinite(quote.impact) ||
    quote.impact < 0 ||
    quote.expires <= now
  )
    throw new Error('A valid price is unavailable. Request a new quote.');
  return quote;
}

/** The integration owns authentication, signing and validation. Mutations resolve
 * after confirmation with authoritative data. Rejections and failed receipts throw.
 */
export interface MarketClient {
  getState(): Promise<MarketState>;
  connect(): Promise<MarketState>;
  changeWallet(): Promise<MarketState>;
  disconnect(): Promise<MarketState>;
  switchNetwork(): Promise<MarketState>;
  verify(): Promise<MarketState>;
  execute(action: MarketAction, accountId: string): Promise<MarketResult>;
  quoteSwap(request: SwapRequest): Promise<SwapQuote>;
  subscribe?(onChange: () => void): () => void;
}

// SepoliaProvider supplies the live adapter; standalone consumers fail closed.
export const marketClient: MarketClient | null = null;
