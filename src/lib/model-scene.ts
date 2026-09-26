import * as THREE from 'three';

export function prepareImportedScene(source: THREE.Object3D): THREE.Object3D {
  const scene = source.clone(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = Math.min(2.8 / Math.max(size.y, 0.001), 3.5 / Math.max(size.x, size.z, 0.001));
  scene.scale.multiplyScalar(scale);
  scene.position.set(-center.x * scale, -bounds.min.y * scale + 0.06, -center.z * scale);
  let index = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.name = `imported-surface-${index++}`;
  });
  scene.updateWorldMatrix(true, true);
  return scene;
}
