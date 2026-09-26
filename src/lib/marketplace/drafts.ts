import { safeDraft } from '../studio';
import type { Draft } from '../types';

export function restoreMarketplaceDraft(input: unknown, origin: string): Draft | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const url = value.assetUrl;
  if (url !== undefined) {
    if (typeof url !== 'string') return null;
    try {
      const parsed = new URL(url, origin);
      if (
        parsed.origin !== origin ||
        !/^\/api\/(assets\/[a-f0-9-]{36}|marketplace\/media\/0x[a-f0-9]{64})$/.test(parsed.pathname)
      )
        return null;
    } catch {
      return null;
    }
  }
  const draft = safeDraft({ ...value, assetUrl: undefined });
  return draft ? { ...draft, assetUrl: url as string | undefined } : null;
}
