import { readFile, copyFile, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { HUMAN_PRESETS, humanWardrobe } from '../src/lib/humans';

async function main() {
  const gender = process.argv[2];
  if (gender !== 'male' && gender !== 'female') throw Error('Choose male or female.');
  const source = path.resolve(`assets/humans/prepared/${gender}-wardrobe`);
  const destination = path.resolve('public/models/humans');
  const presets = HUMAN_PRESETS.filter((p) => p.gender === gender && humanWardrobe(p.id));
  const files = new Set<string>();
  const manifests = [];
  for (const { id } of presets) {
    const manifest = JSON.parse(await readFile(path.join(source, `${id}.json`), 'utf8'));
    const verification = JSON.parse(
      await readFile(path.join(source, `${id}-verification.json`), 'utf8'),
    );
    const wardrobe = humanWardrobe(id)!;
    const parts = [wardrobe.bodyUrl, ...wardrobe.outfitUrls].map((url) =>
      path.basename(url.split('?')[0]),
    );
    assert.equal(manifest.body, parts[0]);
    assert.deepEqual(manifest.outfits, parts.slice(1));
    assert.ok(verification.minimumCoverage >= 0.9, 'Run geometry verification first.');
    let newestSource = 0;
    for (const file of [`${id}.json`, ...parts]) {
      const hash = createHash('sha256')
        .update(await readFile(path.join(source, file)))
        .digest('hex');
      assert.equal(hash, verification.sources[file], 'Assets changed after verification.');
      newestSource = Math.max(newestSource, (await stat(path.join(source, file))).mtimeMs);
    }
    for (const view of ['front', 'back']) {
      const preview = await stat(path.join(source, `${id}-placements-${view}.png`));
      assert.ok(
        preview.mtimeMs >= newestSource,
        'Render current model placements before publishing.',
      );
    }
    for (const file of [...parts, `${id}.png`]) files.add(file);
    manifests.push({ id, ...manifest, reviewed: true, license: 'CC0-1.0' });
  }
  for (const file of files) await copyFile(path.join(source, file), path.join(destination, file));
  for (const { id, ...manifest } of manifests) {
    const target = path.join(destination, `${id}.json`);
    await writeFile(`${target}.tmp`, JSON.stringify(manifest, null, 2));
    await rename(`${target}.tmp`, target);
  }
  console.log(`Installed ${presets.length} reviewed ${gender} outfits.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
