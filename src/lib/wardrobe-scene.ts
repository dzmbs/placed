import * as THREE from 'three';
import type { HumanWardrobe } from './humans';

export function assembleWardrobe(
  body: THREE.Object3D,
  outfits: THREE.Object3D[],
  definition: HumanWardrobe,
): THREE.Group {
  const root = new THREE.Group();
  const skin = body.clone(true);
  for (const name of definition.hiddenBodyMeshes) {
    const region = skin.getObjectByName(name);
    if (!region) throw new Error(`The wardrobe body is missing ${name}.`);
    region.visible = false;
  }
  root.add(skin, ...outfits.map((outfit) => outfit.clone(true)));
  for (const name of definition.hiddenOutfitMeshes) {
    const garment = root.getObjectByName(name);
    if (!garment) throw new Error(`The wardrobe is missing ${name}.`);
    garment.visible = false;
  }
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  // Clone scene nodes so outfit visibility never mutates the loader cache.
  root.updateWorldMatrix(true, true);
  return root;
}
