export interface TransactionProgress {
  phase: 'preparing' | 'wallet' | 'pending' | 'confirmed' | 'refreshing';
  label: string;
  hash?: string;
}
export function reportProgress(progress: TransactionProgress) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('placed-transaction', { detail: progress }));
}
export class ConfirmedActionRefreshError extends Error {
  constructor(public hash?: string) {
    super(
      'Your action completed, but we could not refresh the marketplace. Refresh to see the latest balances and activity.',
    );
    this.name = 'ConfirmedActionRefreshError';
  }
}
export function friendlyMarketError(error: unknown): string {
  if (error instanceof ConfirmedActionRefreshError) return error.message;
  let current: unknown = error;
  for (let i = 0; i < 8 && current && typeof current === 'object'; i++) {
    const e = current as { code?: number; name?: string; message?: string; cause?: unknown };
    if (
      e.code === 4001 ||
      e.name === 'UserRejectedRequestError' ||
      /user (rejected|denied)|request rejected|connection cancelled/i.test(e.message ?? '')
    )
      return 'You cancelled the wallet request. Nothing was submitted.';
    if (e.code === -32002)
      return 'A request is already open in your wallet. Finish or cancel it before trying again.';
    if (/insufficient funds/i.test(e.message ?? ''))
      return 'Your wallet needs more Sepolia ETH for transaction fees.';
    if (e.name === 'WaitForTransactionReceiptTimeoutError')
      return 'Confirmation is taking longer than expected. Use the transaction link to check its status before trying again.';
    if (e.name === 'ContractFunctionRevertedError')
      return 'The contract could not accept this action. Refresh the listing and check its current status and your balance.';
    current = e.cause;
  }
  if (
    error instanceof Error &&
    error.name === 'Error' &&
    error.message.length <= 260 &&
    !/\n|Request Arguments|Details:|https?:\/\//.test(error.message)
  )
    return error.message;
  return 'We could not complete this action. Check your wallet and connection, then try again.';
}
