import 'server-only';
import { getAddress, type Address } from 'viem';
import { compareSponsorshipPhotos } from '../proof-matching';
import { auctionHouseAbi } from '../abi/AuctionHouse';
import { auctionDomain, contracts } from '../config';
import { proofTypes } from '../math';
import type { ProofResult } from '../domain';
import { publicClient, signingAccount, requireDeployment } from './chain';
import { chainId, readCampaign, readSlot } from './reader';
import { mediaHash, loadMedia, storeMedia, validateImage } from './media';
import { database } from './database';
import { RequestError } from './http';

export async function checkProof(
  campaignId: string,
  wallet: Address,
  photo: Buffer,
  type: string,
): Promise<ProofResult> {
  requireDeployment();
  validateImage(photo, type);
  const id = chainId(campaignId);
  const campaign = await readCampaign(id);
  const slot = await readSlot(BigInt(campaign.slotId));
  const asset = await publicClient.readContract({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'getAsset',
    args: [BigInt(slot.assetId)],
  });
  if (getAddress(asset.creator) !== wallet)
    throw new RequestError('Only the asset creator can submit fulfillment proof.', 403);
  const now = Number((await publicClient.getBlock()).timestamp);
  if (campaign.state !== 'displaying' || campaign.displayEnd > now || BigInt(campaign.held) === 0n)
    throw new RequestError('This campaign is not ready for escrow proof.');
  const previous = database()
    .prepare('SELECT created FROM proofs WHERE campaign = ?')
    .get(campaignId) as { created: number } | undefined;
  if (previous && previous.created + 60 > Math.floor(Date.now() / 1000))
    throw new RequestError('Wait one minute before submitting another proof.', 429);
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new RequestError('The proof-photo verifier is not configured. Escrow remains held.', 503);
  const hash = mediaHash(campaign.winningArtworkURI);
  if (!hash || hash !== campaign.winningArtworkHash)
    throw new RequestError(
      'The winning artwork reference does not match its immutable hash. Escrow remains held.',
    );
  const artwork = await loadMedia(hash);
  if (!artwork.type.startsWith('image/'))
    throw new RequestError('The winning artwork is not a supported image.');
  const stored = await storeMedia(photo, type, wallet);
  // Persist a pending result before the paid request so concurrent submissions cannot bypass the cooldown.
  const pending: ProofResult = {
    outcome: 'inconclusive',
    explanation: 'Photo verification is running. Escrow remains held.',
    photoURI: stored.uri,
    photoHash: stored.hash,
  };
  const claimed = database()
    .prepare(
      'INSERT INTO proofs(campaign,wallet,result,created) VALUES(?,?,?,?) ON CONFLICT(campaign) DO UPDATE SET result=excluded.result,created=excluded.created WHERE proofs.created <= excluded.created - 60',
    )
    .run(campaignId, wallet.toLowerCase(), JSON.stringify(pending), Math.floor(Date.now() / 1000));
  if (claimed.changes !== 1)
    throw new RequestError('A proof request is already running. Wait one minute.', 429);
  let decision;
  try {
    decision = await compareSponsorshipPhotos(
      { data: artwork.buffer, type: artwork.type },
      { data: photo, type },
      slot.metadata?.name || 'Front of shirt',
      key,
      process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
    );
  } catch {
    decision = {
      outcome: 'inconclusive' as const,
      explanation: 'Photo verification could not finish. Escrow remains held.',
    };
  }
  const result: ProofResult = { ...pending, ...decision };
  if (result.outcome === 'match') {
    const signer = signingAccount('PROOF_SIGNER_PRIVATE_KEY');
    const expected = await publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'proofSigner',
    });
    if (expected.toLowerCase() !== signer.address.toLowerCase())
      throw new RequestError('The proof signer does not match the deployed contract.', 503);
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const signature = await signer.signTypedData({
      domain: auctionDomain(),
      types: proofTypes,
      primaryType: 'ProofRelease',
      message: {
        campaignId: id,
        artworkHash: campaign.winningArtworkHash,
        proofHash: stored.hash,
        deadline: BigInt(deadline),
      },
    });
    result.authorization = { campaignId, proofHash: stored.hash, deadline, signature };
  }
  database()
    .prepare('UPDATE proofs SET result = ? WHERE campaign = ?')
    .run(JSON.stringify(result), campaignId);
  return result;
}
export async function existingProof(campaignId: string, wallet: Address) {
  const campaign = await readCampaign(chainId(campaignId));
  const slot = await publicClient.readContract({
    address: contracts.auctionHouse,
    abi: auctionHouseAbi,
    functionName: 'getSlot',
    args: [BigInt(campaign.slotId)],
  });
  const [asset, owner] = await Promise.all([
    publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'getAsset',
      args: [slot.assetId],
    }),
    publicClient.readContract({
      address: contracts.auctionHouse,
      abi: auctionHouseAbi,
      functionName: 'owner',
    }),
  ]);
  if (
    ![asset.creator, owner, campaign.bidder].some(
      (address) => address?.toLowerCase() === wallet.toLowerCase(),
    )
  )
    throw new RequestError(
      'This proof is available only to the campaign participants and admin.',
      403,
    );
  const row = database().prepare('SELECT result FROM proofs WHERE campaign = ?').get(campaignId) as
    { result: string } | undefined;
  return row ? (JSON.parse(row.result) as ProofResult) : null;
}
