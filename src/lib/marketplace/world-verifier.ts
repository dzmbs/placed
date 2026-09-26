import type { IDKitResult } from '@worldcoin/idkit-core';

export class WorldVerifierError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export function requireWorldStagingToken(environment: string, token?: string) {
  if (environment === 'staging' && !token)
    throw new WorldVerifierError(
      'World simulator testing needs a temporary staging token. Run npm run world:staging with WORLD_DEVELOPER_API_KEY configured, then restart the server.',
      503,
      'staging_token_missing',
    );
}

export async function verifyWorldProof(
  result: IDKitResult,
  rpId: string,
  environment: string,
  stagingToken?: string,
) {
  requireWorldStagingToken(environment, stagingToken);
  const response = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(environment === 'staging' && stagingToken
        ? { 'x-staging-verification-token': stagingToken }
        : {}),
    },
    body: JSON.stringify(result),
    signal: AbortSignal.timeout(20000),
  });
  const verified = (await response.json()) as {
    environment?: string;
    success?: boolean;
    code?: string;
  };
  if (!response.ok) {
    const code =
      typeof verified.code === 'string' && /^[a-z_]{1,60}$/.test(verified.code)
        ? verified.code
        : 'verification_failed';
    if (code === 'environment_not_allowed')
      throw new WorldVerifierError(
        'World rejected simulator access. Renew the 24-hour staging window with npm run world:staging, then restart the server and start a new verification.',
        503,
        code,
      );
    throw new WorldVerifierError(`World rejected this proof (${code}).`, 401, code);
  }
  if (verified.environment !== environment || verified.success !== true)
    throw new WorldVerifierError(
      'World verification returned an unexpected environment or rejected result.',
      401,
      'verification_failed',
    );
}
