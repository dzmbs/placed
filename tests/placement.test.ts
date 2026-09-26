import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Vector3 } from 'three';
import {
  nudge,
  sizeToSlider,
  sliderToSize,
  straighten,
  surfaceNormal,
  twist,
  uprightRotation,
} from '../src/lib/placement';
import type { Vec3 } from '../src/lib/types';

const axis = (rotation: Vec3, local: [number, number, number]) =>
  new Vector3(...local).applyEuler(new Euler(...rotation));
const close = (a: Vector3, b: Vector3) => assert.ok(a.distanceTo(b) < 1e-6, `${a.toArray()} ≠ ${b.toArray()}`);

test('placements face the surface with their top pointing up', () => {
  for (const normal of [
    [1, 0, 0],
    [0, 0, -1],
    [0.6, 0.3, 0.74],
    [-0.2, -0.4, 0.89],
  ] as Vec3[]) {
    const rotation = uprightRotation(normal);
    close(axis(rotation, [0, 0, 1]), new Vector3(...normal).normalize());
    // The ad's right edge stays level, so text is never tilted.
    assert.ok(Math.abs(axis(rotation, [1, 0, 0]).y) < 1e-6);
    assert.ok(axis(rotation, [0, 1, 0]).y > 0);
  }
});

test('floors and ceilings still get a stable orientation', () => {
  const rotation = uprightRotation([0, 1, 0]);
  close(axis(rotation, [0, 0, 1]), new Vector3(0, 1, 0));
});

test('twist spins around the facing direction and straighten undoes it', () => {
  const upright = uprightRotation([0.6, 0.3, 0.74]);
  const turned = twist(upright, Math.PI / 6);
  close(new Vector3(...surfaceNormal(turned)), new Vector3(...surfaceNormal(upright)));
  close(axis(straighten(turned), [0, 1, 0]), axis(upright, [0, 1, 0]));
});

test('nudge slides along the ad plane, not off the surface', () => {
  const rotation = uprightRotation([1, 0, 0]);
  const moved = new Vector3(...nudge([0, 1, 0], rotation, 0.1, 0.05));
  close(moved, new Vector3(0, 1.05, -0.1));
});

test('size slider is logarithmic and round-trips', () => {
  assert.equal(sizeToSlider(0.05), 0);
  assert.equal(sizeToSlider(3), 1);
  assert.ok(Math.abs(sliderToSize(sizeToSlider(0.45)) - 0.45) < 0.001);
  // Doubling a small ad and a large ad costs the same slider travel.
  const small = sizeToSlider(0.2) - sizeToSlider(0.1);
  const large = sizeToSlider(2) - sizeToSlider(1);
  assert.ok(Math.abs(small - large) < 1e-9);
});
