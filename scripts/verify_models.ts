import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import {
  humanWardrobe,
  HUMAN_PRESETS,
  humanModelUrl,
  maleLook,
  FEMALE_LOOKS,
} from '../src/lib/humans';
import { stat } from 'node:fs/promises';
import { safeDraft, initialDraft } from '../src/lib/studio';
import { prepareImportedScene } from '../src/lib/model-scene';
import { assembleWardrobe } from '../src/lib/wardrobe-scene';
import type { Spot } from '../src/lib/types';

const option = process.argv.indexOf('--prepared');
const gender = option >= 0 ? process.argv[option + 1] : undefined;
if (option >= 0 && gender !== 'male' && gender !== 'female')
  throw Error('Use --prepared male or female.');
const folder = path.resolve(
  gender ? `assets/humans/prepared/${gender}-wardrobe` : 'public/models/humans',
);
const ids = HUMAN_PRESETS.filter(
  (preset) => !gender || (preset.gender === gender && humanWardrobe(preset.id)),
).map((preset) => preset.id);
const cache = new Map<string, THREE.Group>();
async function load(file: string) {
  if (cache.has(file)) return cache.get(file)!;
  const buffer = await readFile(path.join(folder, file));
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
  assert.ok(
    ![...(json.images ?? []), ...(json.buffers ?? [])].some(
      (x) => x.uri && !x.uri.startsWith('data:'),
    ),
    'GLB must be self-contained',
  );
  const loader = new GLTFLoader();
  // Node has no image decoder; retain GLTFLoader's real material parser.
  loader.register(() => ({
    name: 'LOCAL_TEXTURE_QA',
    loadTexture: () => Promise.resolve(new THREE.Texture()),
  }));
  const gltf = await loader.parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    '',
  );
  cache.set(file, gltf.scene);
  console.log(`${file}: ${(buffer.length / 1_000_000).toFixed(2)} MB`);
  return gltf.scene;
}
async function main() {
  const assemblies: { id: (typeof ids)[number]; scene: THREE.Object3D }[] = [];
  if (!gender) await load('../carry-on.glb');
  for (const id of ids) {
    const male = maleLook(id);
    const female = HUMAN_PRESETS.find((preset) => preset.id === id)!.gender === 'female';
    const definition = humanWardrobe(id);
    const metadata = JSON.parse(await readFile(path.join(folder, `${id}.json`), 'utf8'));
    if (!gender) assert.equal(metadata.reviewed, true, `${id} is reviewed`);
    assert.ok(
      safeDraft({ ...initialDraft(), asset: 'dress', humanPreset: id, spots: metadata.spots }),
      `${id} manifest is a valid draft`,
    );
    assert.ok((await stat(path.join(folder, `${id}.png`))).size > 100, `${id} has a thumbnail`);
    let scene: THREE.Object3D;
    if (definition) {
      assert.deepEqual(
        [...metadata.hiddenBodyMeshes].sort(),
        [...definition.hiddenBodyMeshes].sort(),
      );
      assert.deepEqual(
        [...metadata.hiddenOutfitMeshes].sort(),
        [...definition.hiddenOutfitMeshes].sort(),
      );
      assert.equal(metadata.body, path.basename(definition.bodyUrl.split('?')[0]));
      assert.deepEqual(
        metadata.outfits,
        definition.outfitUrls.map((url) => path.basename(url.split('?')[0])),
      );
      const body = await load(metadata.body);
      const outfits: THREE.Group[] = await Promise.all(
        metadata.outfits.map((file: string) => load(file)),
      );
      scene = assembleWardrobe(body, outfits, definition);
      for (const source of [body, ...outfits])
        source.traverse((node) =>
          assert.equal(node.visible, true, 'loader cache visibility stays intact'),
        );
    } else {
      scene = prepareImportedScene(await load(path.basename(humanModelUrl(id))));
    }
    assemblies.push({ id, scene });
    if (male) {
      assert.equal(scene.getObjectByName('body-under-jeans')!.visible, male.bottom === 'shorts');
      assert.equal(scene.getObjectByName('body-under-top')!.visible, male.top === 'none');
      assert.equal(scene.getObjectByName('body-under-bottom')!.visible, false);
      assert.equal(scene.getObjectByName('shirt')!.visible, male.top === 'cotton');
      assert.equal(scene.getObjectByName('sport-shirt')!.visible, male.top === 'technical');
      assert.equal(scene.getObjectByName('jeans')!.visible, male.bottom === 'jeans');
      assert.equal(scene.getObjectByName('shorts')!.visible, male.bottom === 'shorts');
    } else if (definition && female) {
      const look = FEMALE_LOOKS.find((look) => look.id === id)!;
      for (const region of [0, 1, 3, 5, 7]) {
        assert.equal(
          scene.getObjectByName(`female-skin-${region}`)!.visible,
          !(region & look.coverage),
        );
      }
      for (const name of [
        'female-shirt',
        'female-jeans',
        'female-sport-top',
        'female-leggings',
        'female-dress',
      ]) {
        assert.equal(
          scene.getObjectByName(name)!.visible,
          (look.garments as readonly string[]).includes(name),
        );
      }
    }
    if (definition)
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          assert.equal(
            material.transparent,
            false,
            `${mesh.name}: no blended skin/clothing/hair sorting`,
          );
          assert.equal(material.depthWrite, true, `${mesh.name}: surface must write depth`);
          assert.equal(material.opacity, 1, `${mesh.name}: solid opacity`);
          assert.equal(
            material.alphaTest,
            ['hair', 'eyebrows', 'eyelashes'].includes(mesh.name) ? 0.5 : 0,
            `${mesh.name}: correct cutout/opaque policy`,
          );
        }
      });
    const bounds = new THREE.Box3().setFromObject(scene);
    assert.ok(
      Math.abs(bounds.min.y - 0.06) < 0.005 && Math.abs(bounds.max.y - 2.86) < 0.005,
      'assembled parts use the authored common scale',
    );
    const decals = [];
    let minimumCoverage = Infinity;
    for (const spot of metadata.spots as Spot[]) {
      const mesh = scene.getObjectByName(spot.meshName!) as THREE.Mesh;
      assert.ok(mesh?.isMesh, `${spot.name} has a real surface`);
      assert.equal(mesh.visible, true, `${spot.name} targets a visible surface`);
      const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...spot.rotation));
      const hits = new THREE.Raycaster(
        new THREE.Vector3(...spot.position).addScaledVector(normal, 0.05),
        normal.clone().negate(),
        0,
        0.1,
      ).intersectObject(mesh);
      assert.ok(hits.length, `${spot.name} touches the garment`);
      const faceNormal = hits[0]
        .face!.normal.clone()
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
      if (definition)
        assert.ok(
          normal.dot(faceNormal) > 0.95,
          `${spot.name} projector faces out from the surface`,
        );
      const geometry = new DecalGeometry(
        mesh,
        new THREE.Vector3(...spot.position),
        new THREE.Euler(...spot.rotation),
        new THREE.Vector3(spot.width, spot.height, 0.22),
      );
      assert.ok(geometry.attributes.position.count, `${spot.name} projects onto triangles`);
      const uv = geometry.attributes.uv.array;
      let coverage = 0;
      for (let i = 0; i < uv.length; i += 6) {
        coverage +=
          Math.abs(
            (uv[i + 2] - uv[i]) * (uv[i + 5] - uv[i + 1]) -
              (uv[i + 4] - uv[i]) * (uv[i + 3] - uv[i + 1]),
          ) / 2;
      }
      minimumCoverage = Math.min(minimumCoverage, coverage);
      if (definition)
        assert.ok(
          coverage >= 0.9,
          `${spot.name}: logo must fit the surface (${(coverage * 100).toFixed(1)}% coverage)`,
        );
      decals.push({
        id: spot.id,
        positions: [...geometry.attributes.position.array],
        normals: [...geometry.attributes.normal.array],
        uv: [...geometry.attributes.uv.array],
      });
      geometry.dispose();
    }
    if (gender) {
      await writeFile(path.join(folder, `${id}-decals-qa.json`), JSON.stringify(decals));
      const files = [`${id}.json`, metadata.body, ...metadata.outfits] as string[];
      const sources = Object.fromEntries(
        await Promise.all(
          files.map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(path.join(folder, file)))
              .digest('hex'),
          ]),
        ),
      );
      await writeFile(
        path.join(folder, `${id}-verification.json`),
        JSON.stringify({ sources, minimumCoverage }),
      );
    }
    console.log(
      `${id}: ${decals.length} placements verified, ${(minimumCoverage * 100).toFixed(1)}% minimum logo coverage`,
    );
  }
  for (const bodyGender of ['male', 'female']) {
    const scenes = assemblies
      .filter(({ id }) => id.startsWith(`${bodyGender}-`) && humanWardrobe(id))
      .map(({ scene }) => scene);
    if (!scenes.length) continue;
    const names =
      bodyGender === 'female'
        ? ['hair', 'eyes', 'female-skin-0', 'female-skin-7']
        : ['hair', 'eyes', 'body-visible', 'body-under-top', 'body-under-jeans'];
    for (const name of names)
      for (const scene of scenes.slice(1)) {
        const first = scenes[0].getObjectByName(name) as THREE.Mesh;
        const current = scene.getObjectByName(name) as THREE.Mesh;
        assert.equal(first.geometry, current.geometry, `${name}: shared geometry`);
        assert.deepEqual(
          first.matrixWorld.elements,
          current.matrixWorld.elements,
          `${name}: shared coordinates`,
        );
      }
  }
  console.log(`${ids.length} models verified; shared body identity and loader caches preserved.`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
