import { open, readFile, rename, unlink } from 'node:fs/promises';

async function main() {
  const apiKey = process.env.WORLD_DEVELOPER_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  const rpId = process.env.WORLD_RP_ID;
  if (!apiKey?.startsWith('api_') || !appId || !rpId)
    throw Error(
      'Set WORLD_DEVELOPER_API_KEY, NEXT_PUBLIC_WORLD_APP_ID and WORLD_RP_ID in .env.local.',
    );
  if ((process.env.WORLD_ENVIRONMENT || 'staging') !== 'staging')
    throw Error('This command is for simulator testing. Set WORLD_ENVIRONMENT=staging first.');

  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch('https://developer.world.org/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const body = (await response.json()) as {
      error?: { code: number };
      result?: { isError?: boolean; content?: Array<{ type: string; text?: string }> };
    };
    if (!response.ok || body.error || body.result?.isError)
      throw Error(
        `World Portal ${name} failed (HTTP ${response.status}, RPC ${body.error?.code ?? 'unknown'}). Check the team API key and app configuration.`,
      );
    const text = body.result?.content?.find((item) => item.type === 'text')?.text;
    if (!text) throw Error('World Portal returned an unexpected response.');
    return JSON.parse(text) as T;
  }

  const config = await call<{ app: { rp_registration: Array<{ rp_id: string; status: string }> } }>(
    'get_app_config',
    { app_id: appId },
  );
  const registration = config.app.rp_registration.find((item) => item.rp_id === rpId);
  if (!registration || registration.status !== 'registered')
    throw Error('The configured app and RP must match and have a completed registration.');

  const original = await readFile('.env.local', 'utf8');
  const temporary = '.env.local.world-staging.tmp';
  const file = await open(temporary, 'wx', 0o600);
  try {
    const result = await call<{
      rp_id: string;
      staging_verification_token: string;
      staging_verification_expires_at: string;
    }>('set_world_id_staging_verification', { app_id: appId, enabled: true });
    if (
      result.rp_id !== rpId ||
      !/^[a-zA-Z0-9_-]+$/.test(result.staging_verification_token) ||
      !Number.isFinite(Date.parse(result.staging_verification_expires_at))
    )
      throw Error('World Portal returned invalid staging credentials.');
    const replacements: Record<string, string> = {
      WORLD_STAGING_VERIFICATION_TOKEN: result.staging_verification_token,
      WORLD_STAGING_VERIFICATION_EXPIRES_AT: result.staging_verification_expires_at,
    };
    let updated = original;
    for (const [key, value] of Object.entries(replacements)) {
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      updated = pattern.test(updated)
        ? updated.replace(pattern, `${key}=${value}`)
        : `${updated.trimEnd()}\n${key}=${value}\n`;
    }
    await file.writeFile(updated);
    await file.sync();
    await file.close();
    await rename(temporary, '.env.local');
    console.log(
      `World simulator access enabled until ${result.staging_verification_expires_at}. Token saved privately in .env.local. Restart the server and start a fresh verification.`,
    );
  } catch (error) {
    await file.close();
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error && /^(Set |This command|World Portal|The configured)/.test(error.message)
      ? error.message
      : 'World staging setup failed. No credentials were printed. Check connectivity and local file permissions.',
  );
  process.exitCode = 1;
});
