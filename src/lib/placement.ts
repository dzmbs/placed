import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Vec3 } from './types';

const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

// Face the surface (local +Z along the normal) with the ad's top pointing as
// close to world up as the surface allows. Aligning +Z alone leaves the twist
// around the normal arbitrary, which is what made placements land rotated.
export function uprightRotation(normal: Vec3): Vec3 {
  const z = new Vector3(...normal).normalize();
  // On floors and ceilings "up" is undefined, so fall back to facing forward.
  const reference = Math.abs(z.dot(UP)) > 0.98 ? FORWARD : UP;
  const x = new Vector3().crossVectors(reference, z).normalize();
  const y = new Vector3().crossVectors(z, x);
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  const e = new Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}
export function surfaceNormal(rotation: Vec3): Vec3 {
  return FORWARD.clone()
    .applyEuler(new Euler(...rotation))
    .toArray() as Vec3;
}
// Spin the ad around its own facing direction.
export function twist(rotation: Vec3, radians: number): Vec3 {
  const q = new Quaternion()
    .setFromEuler(new Euler(...rotation))
    .multiply(new Quaternion().setFromAxisAngle(FORWARD, radians));
  const e = new Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}
export function straighten(rotation: Vec3): Vec3 {
  return uprightRotation(surfaceNormal(rotation));
}
// Slide along the ad's own right/up axes; the decal re-projects onto the mesh.
export function nudge(position: Vec3, rotation: Vec3, right: number, up: number): Vec3 {
  const euler = new Euler(...rotation);
  return new Vector3(...position)
    .add(new Vector3(1, 0, 0).applyEuler(euler).multiplyScalar(right))
    .add(new Vector3(0, 1, 0).applyEuler(euler).multiplyScalar(up))
    .toArray() as Vec3;
}
// Sizes span small logos to large panels. A log scale gives the same slider
// travel for "twice as big" at any size, so small ads are not twitchy.
export const SIZE_MIN = 0.05;
export const SIZE_MAX = 3;
export function sizeToSlider(size: number) {
  const clamped = Math.min(SIZE_MAX, Math.max(SIZE_MIN, size));
  return Math.log(clamped / SIZE_MIN) / Math.log(SIZE_MAX / SIZE_MIN);
}
export function sliderToSize(value: number) {
  return Number((SIZE_MIN * (SIZE_MAX / SIZE_MIN) ** value).toFixed(3));
}
