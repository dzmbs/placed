import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  getAddress,
  toHex,
  keccak256,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { auctionHouseAbi } from '../src/lib/marketplace/abi/AuctionHouse';
import { ensAssetRegistryAbi } from '../src/lib/marketplace/abi/ENSAssetRegistry';

const registrar = getAddress('0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca');
const registrationCurrency = getAddress('0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e');
const registrarAbi = parseAbi([
  'function isAvailable(string) view returns (bool)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
  'function makeCommitment(string,address,bytes32,address,address,uint64,bytes32) pure returns (bytes32)',
  'function commitmentAt(bytes32) view returns (uint64)',
  'function commit(bytes32)',
  'function getRegisterPrice(string,uint64,address) view returns(uint256,uint256)',
  'function register(string,address,bytes32,address,address,uint64,address,bytes32) returns(uint256)',
]);
const tokenAbi = parseAbi([
  'function mint(address,uint256)',
  'function approve(address,uint256) returns(bool)',
]);

interface SetupState {
  creator: Address;
  parent: string;
  secret: Hex;
  startBlock: string;
  transactions: Hex[];
  demoUSDC?: Address;
  auctionHouse?: Address;
  launchCoordinator?: Address;
  ensRegistry?: Address;
  configured?: boolean;
  registered?: boolean;
}

async function main() {
  const value = process.env.PRIVATE_KEY;
  const proofKey = process.env.PROOF_SIGNER_PRIVATE_KEY;
  if (!value || !proofKey)
    throw new Error('PRIVATE_KEY and PROOF_SIGNER_PRIVATE_KEY must be configured.');
  const account = privateKeyToAccount((value.startsWith('0x') ? value : `0x${value}`) as Hex);
  const proofSigner = privateKeyToAccount(
    (proofKey.startsWith('0x') ? proofKey : `0x${proofKey}`) as Hex,
  );
  const transport = http(
    process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  );
  const client = createPublicClient({ chain: sepolia, transport });
  const wallet = createWalletClient({ account, chain: sepolia, transport });
  if ((await client.getChainId()) !== sepolia.id)
    throw new Error('Deployment is restricted to Ethereum Sepolia.');
  const parent = process.env.ENS_PARENT_NAME || 'placed-demo.eth';
  if (!/^[a-z0-9-]{3,63}\.eth$/.test(parent))
    throw new Error('Choose a lowercase ENSv2 .eth demo parent.');
  const label = parent.slice(0, -4),
    duration = 365n * 86400n;
  await mkdir('data', { recursive: true, mode: 0o700 });
  let state: SetupState;
  try {
    state = JSON.parse(await readFile('data/sepolia-setup.json', 'utf8'));
  } catch {
    state = {
      creator: account.address,
      parent,
      secret: toHex(randomBytes(32)),
      startBlock: String(await client.getBlockNumber()),
      transactions: [],
    };
  }
  if (state.creator !== account.address || state.parent !== parent)
    throw new Error('Existing setup belongs to another wallet or ENS parent.');
  if (process.env.REPLACE_DEPLOYMENT === 'true' && state.configured) {
    const count = await client.readContract({
      address: state.auctionHouse!,
      abi: auctionHouseAbi,
      functionName: 'assetCount',
    });
    if (count !== 0n) throw new Error('Cannot replace a deployment with published assets.');
    await writeFile(`data/sepolia-setup-${Date.now()}.json`, JSON.stringify(state), {
      mode: 0o600,
    });
    state = {
      creator: account.address,
      parent,
      secret: state.secret,
      demoUSDC: state.demoUSDC,
      startBlock: String(await client.getBlockNumber()),
      transactions: [],
      registered: state.registered,
    };
  }
  const persist = () =>
    writeFile('data/sepolia-setup.json', JSON.stringify(state, null, 2), { mode: 0o600 });
  await persist();
  async function confirmed(hash: Hex) {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Sepolia transaction reverted: ${hash}`);
    state.transactions.push(hash);
    await persist();
    console.log(`Confirmed: ${hash}`);
    return receipt;
  }
  async function deploy(name: string, args: readonly unknown[]): Promise<Address> {
    const artifact = JSON.parse(await readFile(`contracts/out/${name}.sol/${name}.json`, 'utf8'));
    const hash = await wallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode.object as Hex,
      args,
    });
    const receipt = await confirmed(hash);
    if (!receipt.contractAddress) throw new Error('Deployment address missing.');
    return receipt.contractAddress;
  }
  if (!state.demoUSDC) {
    state.demoUSDC = await deploy('DemoUSDC', []);
    await persist();
  }
  if (!state.auctionHouse) {
    state.auctionHouse = await deploy('AuctionHouse', [
      state.demoUSDC,
      account.address,
      account.address,
      proofSigner.address,
    ]);
    await persist();
  }
  if (!state.launchCoordinator) {
    state.launchCoordinator = await deploy('AssetLaunchCoordinator', [
      state.auctionHouse,
      '0x95434E898Af471945Cab33D5064d2aC1A6Ba2000',
      '0x000000001F26a0044BaA66024e7b6599c61963F8',
    ]);
    await persist();
  }
  if (!state.ensRegistry) {
    const dns = toHex(
      Buffer.concat([
        Buffer.from([label.length]),
        Buffer.from(label),
        Buffer.from([3]),
        Buffer.from('eth'),
        Buffer.from([0]),
      ]),
    );
    const now = (await client.getBlock()).timestamp;
    state.ensRegistry = await deploy('ENSAssetRegistry', [
      state.auctionHouse,
      '0x9e726Eb570beb6BCEb495AB8cdA7df517d4e841C',
      '0xA80338aAA8D23831cEa25E858D1774534aBb0263',
      '0x14F09Fd05d4585759e54844DC9B00147131Cf243',
      dns,
      now + duration,
    ]);
    await persist();
  }
  const root = await client.readContract({
    address: state.ensRegistry,
    abi: ensAssetRegistryAbi,
    functionName: 'rootRegistry',
  });
  if (state.registered && !state.configured) {
    const registry = getAddress('0x657ea849311d3d5823348dded7c2aaafb3ede09e');
    const abi = parseAbi([
      'function getSubregistry(string) view returns(address)',
      'function setSubregistry(uint256,address)',
    ]);
    const current = await client.readContract({
      address: registry,
      abi,
      functionName: 'getSubregistry',
      args: [label],
    });
    if (current.toLowerCase() !== root.toLowerCase())
      await confirmed(
        await wallet.writeContract({
          address: registry,
          abi,
          functionName: 'setSubregistry',
          args: [BigInt(keccak256(toHex(label))), root],
        }),
      );
  }
  if (!state.registered) {
    const available = await client.readContract({
      address: registrar,
      abi: registrarAbi,
      functionName: 'isAvailable',
      args: [label],
    });
    if (!available)
      throw new Error('ENS parent is unavailable. Registration has not been attempted.');
    const commitment = await client.readContract({
      address: registrar,
      abi: registrarAbi,
      functionName: 'makeCommitment',
      args: [
        label,
        account.address,
        state.secret,
        root,
        zeroAddress,
        duration,
        toHex(0n, { size: 32 }),
      ],
    });
    let committed = await client.readContract({
      address: registrar,
      abi: registrarAbi,
      functionName: 'commitmentAt',
      args: [commitment],
    });
    if (committed === 0n) {
      await confirmed(
        await wallet.writeContract({
          address: registrar,
          abi: registrarAbi,
          functionName: 'commit',
          args: [commitment],
        }),
      );
      committed = await client.readContract({
        address: registrar,
        abi: registrarAbi,
        functionName: 'commitmentAt',
        args: [commitment],
      });
    }
    const age = await client.readContract({
      address: registrar,
      abi: registrarAbi,
      functionName: 'MIN_COMMITMENT_AGE',
    });
    while ((await client.getBlock()).timestamp < committed + age) {
      console.log('Waiting for the ENS commitment window.');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    const [base, premium] = await client.readContract({
      address: registrar,
      abi: registrarAbi,
      functionName: 'getRegisterPrice',
      args: [label, duration, registrationCurrency],
    });
    await confirmed(
      await wallet.writeContract({
        address: registrationCurrency,
        abi: tokenAbi,
        functionName: 'mint',
        args: [account.address, base + premium],
      }),
    );
    await confirmed(
      await wallet.writeContract({
        address: registrationCurrency,
        abi: tokenAbi,
        functionName: 'approve',
        args: [registrar, base + premium],
      }),
    );
    await confirmed(
      await wallet.writeContract({
        address: registrar,
        abi: registrarAbi,
        functionName: 'register',
        args: [
          label,
          account.address,
          state.secret,
          root,
          zeroAddress,
          duration,
          registrationCurrency,
          toHex(0n, { size: 32 }),
        ],
      }),
    );
    state.registered = true;
    await persist();
  }
  if (!state.configured) {
    await confirmed(
      await wallet.writeContract({
        address: state.auctionHouse,
        abi: auctionHouseAbi,
        functionName: 'configureServices',
        args: [state.ensRegistry, state.launchCoordinator],
      }),
    );
    state.configured = true;
    await persist();
  }
  const deployment = {
    chainId: sepolia.id,
    status: 'deployed',
    auctionHouse: state.auctionHouse,
    demoUSDC: state.demoUSDC,
    launchCoordinator: state.launchCoordinator,
    ensRegistry: state.ensRegistry,
    ensParent: parent,
    startBlock: state.startBlock,
    ccaFactory: '0x000000001F26a0044BaA66024e7b6599c61963F8',
    lbpStrategy: '0x95434E898Af471945Cab33D5064d2aC1A6Ba2000',
    positionManager: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
    transactions: state.transactions,
  };
  await writeFile(
    'src/lib/marketplace/deployment.json',
    JSON.stringify(deployment, null, 2) + '\n',
  );
  console.log(`Deployed Placed on Ethereum Sepolia. ENS parent: ${parent}`);
}
main().catch((error) => {
  const summary =
    typeof error?.shortMessage === 'string'
      ? error.shortMessage.split('\n')[0]
      : error instanceof Error
        ? error.message.split('\n')[0]
        : 'Unknown error';
  console.error(
    `Deployment stopped: ${summary.replace(/0x[a-fA-F0-9]{64,}/g, '[redacted]')}. State is saved in data/sepolia-setup.json.`,
  );
  process.exitCode = 1;
});
