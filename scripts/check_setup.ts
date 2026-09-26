import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import { contracts, marketplaceChain, marketplaceReady } from '../src/lib/marketplace/config';
import { auctionHouseAbi } from '../src/lib/marketplace/abi/AuctionHouse';
import { HUMAN_PRESETS, humanModelUrl, humanWardrobe } from '../src/lib/humans';

async function main() {
  const origin = new URL(
    process.argv[2] || (process.env.APP_ORIGIN || 'http://127.0.0.1:3000').split(',')[0].trim(),
  ).origin;
  let issues = 0;
  const fail = (message: string) => {
    issues++;
    console.log(`CHECK: ${message}`);
  };
  const allow = (process.env.APP_ORIGIN || 'http://127.0.0.1:3000')
    .split(',')
    .map((value) => new URL(value.trim()).origin);
  if (!allow.includes(origin))
    fail(`APP_ORIGIN does not include ${origin}. Add this origin and allow it in Privy.`);
  else console.log(`OK: application origin ${origin}. Also allow this exact origin in Privy.`);
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID)
    fail('Privy app ID is missing; wallet connection will be unavailable.');
  if (!marketplaceReady)
    fail('The checked-out contract deployment is incomplete. Pull the current main branch.');
  const expected = new Set<string>(['/models/carry-on.glb']);
  for (const preset of HUMAN_PRESETS) {
    const wardrobe = humanWardrobe(preset.id);
    for (const url of wardrobe
      ? [wardrobe.bodyUrl, ...wardrobe.outfitUrls]
      : [humanModelUrl(preset.id)])
      expected.add(url.split('?')[0]);
    expected.add(`/models/humans/${preset.id}.json`);
    expected.add(`/models/humans/${preset.id}.png`);
  }
  for (const url of expected) {
    try {
      const file = path.join(process.cwd(), 'public', url);
      if ((await stat(file)).size < 20) throw new Error('Empty model');
      if (url.endsWith('.glb') && (await readFile(file)).toString('ascii', 0, 4) !== 'glTF')
        throw new Error('Invalid model');
    } catch {
      fail(
        `Missing or incomplete built-in file: public${url}. These files are committed; restore them from main.`,
      );
    }
  }
  if (!issues)
    console.log(`OK: ${expected.size} built-in model files, manifests and thumbnails are present.`);
  for (const folder of ['data/assets', 'data/marketplace-media']) {
    try {
      await stat(folder);
      console.log(`OK: ${folder} exists locally.`);
    } catch {
      console.log(
        `INFO: ${folder} is absent. Personal uploads and published local media are not copied by Git or .env.local.`,
      );
    }
  }
  const rpc = createPublicClient({
    chain: marketplaceChain,
    transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com', {
      timeout: 15000,
      retryCount: 0,
    }),
  });
  try {
    const chainId = await rpc.getChainId();
    if (chainId !== marketplaceChain.id) throw new Error('Wrong chain');
    const count = await rpc.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'assetCount',
    });
    console.log(`OK: server RPC reaches Sepolia and the deployed marketplace (${count} assets).`);
  } catch (error) {
    fail(
      `Server RPC check failed (${error instanceof Error ? error.name : 'unknown error'}). Check network access and SEPOLIA_RPC_URL. Provider URLs and credentials are intentionally omitted.`,
    );
  }
  try {
    const response = await fetch(`${origin}/api/marketplace/state`, {
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      fail(
        `Running app returned HTTP ${response.status} for market state. Restart it after updating .env.local; then run npm run verify:marketplace.`,
      );
    else {
      const state = await response.json();
      const missing = state.assets.filter(
        (asset: { metadata?: unknown }) => !asset.metadata,
      ).length;
      console.log(`OK: market state HTTP 200 (${state.assets.length} assets).`);
      if (missing)
        fail(
          `${missing} listings have unavailable metadata. Their public media lives on the publisher's server; use a shared hosted backend or a sanitized public-media export.`,
        );
    }
  } catch {
    fail(`Cannot reach the app at ${origin}. Start it on this port before running this check.`);
  }
  process.exitCode = issues ? 1 : 0;
}
main().catch(() => {
  console.error('Setup check could not finish. Check the supplied local origin.');
  process.exitCode = 1;
});
