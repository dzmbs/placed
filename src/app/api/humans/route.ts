import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { HUMAN_PRESETS, humanModelUrl, humanWardrobe } from '@/lib/humans';
import { initialDraft, safeDraft } from '@/lib/studio';
import { assertLocalRequest } from '@/lib/server/storage';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const available = await Promise.all(
      HUMAN_PRESETS.map(async (preset) => {
        try {
          const folder = path.join(process.cwd(), 'public/models/humans');
          const metadata = JSON.parse(
            await readFile(path.join(folder, `${preset.id}.json`), 'utf8'),
          );
          if (metadata.reviewed !== true) return null;
          const wardrobe = humanWardrobe(preset.id);
          const modelUrls = wardrobe
            ? [wardrobe.bodyUrl, ...wardrobe.outfitUrls]
            : [humanModelUrl(preset.id)];
          const files = await Promise.all(
            modelUrls.map((url) => stat(path.join(process.cwd(), 'public', url.split('?')[0]))),
          );
          const thumbnail = await stat(path.join(folder, `${preset.id}.png`));
          if (files.some((file) => !file.isFile() || file.size < 100) || !thumbnail.isFile())
            return null;
          const draft = safeDraft({
            ...initialDraft(),
            asset: 'dress',
            humanPreset: preset.id,
            spots: metadata.spots,
          });
          if (!draft) return null;
          return {
            id: preset.id,
            spots: draft.spots,
            thumbnail: `/models/humans/${preset.id}.png`,
          };
        } catch {
          return null;
        }
      }),
    );
    return Response.json(
      { humans: available.filter(Boolean) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'The apparel library could not be loaded.' }, { status: 400 });
  }
}
