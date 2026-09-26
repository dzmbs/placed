'use client';

import { useEffect, useMemo } from 'react';
import { RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from '@/lib/types';

// Reuse the fitted garment, with its collar, sleeve openings and fabric folds.
// The loader's shared geometry/materials remain untouched by this hero treatment.
export function HeroShirt() {
  const { scene } = useGLTF('/models/humans/male-casual-outfit.glb?v=4', '/draco/');
  const shirt = scene.getObjectByName('shirt') as THREE.Mesh;
  const weave = useMemo(() => {
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const offset = (y * 16 + x) * 4;
        const value =
          128 + Math.round(30 * Math.sin((x * Math.PI) / 2) * Math.cos((y * Math.PI) / 2));
        pixels.set([value, value, value, 255], offset);
      }
    }
    const texture = new THREE.DataTexture(pixels, 16, 16);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(48, 48);
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  const fabric = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#b7c3a2',
        roughness: 0.92,
        metalness: 0,
        sheen: 0.45,
        sheenColor: new THREE.Color('#dfe4d4'),
        sheenRoughness: 0.9,
        bumpMap: weave,
        bumpScale: 0.0015,
        side: THREE.DoubleSide,
      }),
    [weave],
  );
  useEffect(
    () => () => {
      weave.dispose();
      fabric.dispose();
    },
    [weave, fabric],
  );
  return (
    <mesh
      geometry={shirt.geometry}
      material={fabric}
      scale={2.8}
      position={[0.027, -5.57, 0.51]}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}

function DetailBox({
  position,
  size,
  color = '#35443a',
  metalness = 0.45,
}: {
  position: Vec3;
  size: Vec3;
  color?: string;
  metalness?: number;
}) {
  return (
    <RoundedBox
      position={position}
      args={size}
      radius={Math.min(0.025, ...size.map((n) => n / 3))}
      smoothness={4}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.38} metalness={metalness} />
    </RoundedBox>
  );
}

function DetailTube({
  points,
  radius = 0.012,
  color = '#58645b',
  metalness = 0.7,
  closed = false,
}: {
  points: Vec3[];
  radius?: number;
  color?: string;
  metalness?: number;
  closed?: boolean;
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
        closed,
      ),
    [points, closed],
  );
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, 48, radius, 8, closed]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={0.32} />
    </mesh>
  );
}

function Bolt({ position, radius = 0.018 }: { position: Vec3; radius?: number }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[radius, radius, 0.012, 6]} />
      <meshStandardMaterial color="#afb6ae" metalness={0.85} roughness={0.3} />
    </mesh>
  );
}

function CarryOnDetails() {
  return (
    <group>
      {[-0.69, 0.69].flatMap((x) =>
        [2.15, 2.27].map((y) => <Bolt key={`${x}-${y}`} position={[x, y, 0.407]} radius={0.015} />),
      )}
      {[-1, 1].map((side) => (
        <group key={side}>
          <DetailBox
            position={[side * 0.816, 1.83, 0.04]}
            size={[0.018, 0.2, 0.035]}
            color="#a2aaa0"
          />
          <DetailBox
            position={[side * 0.816, 1.7, 0.04]}
            size={[0.02, 0.11, 0.065]}
            color="#a2aaa0"
          />
          <DetailBox
            position={[side * 0.31, 2.6, -0.08]}
            size={[0.02, 0.54, 0.009]}
            color="#d0d5ce"
          />
        </group>
      ))}
      <DetailBox
        position={[0.825, 2.05, 0]}
        size={[0.028, 0.19, 0.19]}
        color="#28302b"
        metalness={0.1}
      />
      {[0, 1, 2].map((i) => (
        <DetailBox
          key={i}
          position={[0.846, 2.09 - i * 0.04, 0.015]}
          size={[0.014, 0.025, 0.1]}
          color="#9ca59a"
        />
      ))}
    </group>
  );
}

function BillboardDetails() {
  return (
    <group>
      {[-1.62, 1.62].flatMap((x) =>
        [1.34, 2.05, 2.77].map((y) => <Bolt key={`${x}-${y}`} position={[x, y, 0.127]} />),
      )}
      {[-1, 1].map((x) => (
        <group key={x}>
          <DetailTube
            points={[
              [x, 0.95, -0.07],
              [x, 1.45, -0.3],
              [x, 2.5, -0.2],
            ]}
            radius={0.035}
          />
          <DetailBox position={[x, 0.08, -0.07]} size={[0.28, 0.035, 0.34]} />
          {[-0.12, 0.12].map((offset) => (
            <Bolt key={offset} position={[x + offset, 0.09, 0.1]} radius={0.02} />
          ))}
        </group>
      ))}
      {Array.from({ length: 25 }, (_, i) => (
        <DetailBox
          key={i}
          position={[-1.56 + i * 0.13, 1.236, 0.25]}
          size={[0.018, 0.008, 0.35]}
          color="#afb7ac"
        />
      ))}
      {[-1.28, -0.43, 0.43, 1.28].map((x) => (
        <DetailTube
          key={x}
          points={[
            [x, 2.84, -0.025],
            [x, 2.94, 0.1],
            [x, 2.92, 0.3],
          ]}
          radius={0.007}
          color="#1c2b22"
          metalness={0}
        />
      ))}
    </group>
  );
}

function BicycleDetails() {
  return (
    <group>
      {/* Drivetrain, paired fork, rotors and cable runs give the side profile real depth. */}
      <DetailTube
        points={[
          [-1.14, 0.74, 0.1],
          [-0.2, 0.835, 0.1],
          [-0.065, 0.7, 0.1],
          [-0.2, 0.565, 0.1],
          [-1.14, 0.58, 0.1],
          [-1.22, 0.66, 0.1],
        ]}
        closed
        radius={0.009}
        color="#4b514a"
      />
      {[-1.14, 1.14].map((x) => (
        <group key={x} position={[x, 0.66, 0.085]}>
          <mesh>
            <ringGeometry args={[0.085, 0.19, 48]} />
            <meshStandardMaterial
              color="#abb1a8"
              metalness={0.9}
              roughness={0.24}
              side={THREE.DoubleSide}
            />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <Bolt
              key={i}
              position={[
                Math.cos((i * Math.PI) / 4) * 0.145,
                Math.sin((i * Math.PI) / 4) * 0.145,
                0.01,
              ]}
              radius={0.012}
            />
          ))}
        </group>
      ))}
      <mesh position={[-1.14, 0.66, 0.12]}>
        <torusGeometry args={[0.08, 0.018, 8, 40]} />
        <meshStandardMaterial color="#727a6e" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-0.08, 0.08].map((z) => (
        <DetailTube
          key={z}
          points={[
            [0.79, 1.64, 0],
            [0.95, 1.15, z],
            [1.14, 0.66, z],
          ]}
          radius={0.025}
          color="#889a77"
        />
      ))}
      <DetailTube
        points={[
          [0.98, 1.83, 0.27],
          [0.6, 1.91, 0.12],
          [0.75, 1.56, 0.12],
          [1.06, 0.83, 0.1],
        ]}
        radius={0.007}
        color="#242c24"
        metalness={0}
      />
      <DetailTube
        points={[
          [0.98, 1.83, -0.27],
          [0.53, 1.85, -0.12],
          [-0.45, 1.7, -0.09],
          [-1.06, 0.81, -0.07],
        ]}
        radius={0.007}
        color="#242c24"
        metalness={0}
      />
      <DetailTube
        points={[
          [-0.2, 0.7, -0.13],
          [-0.2, 0.94, -0.13],
        ]}
        radius={0.018}
      />
      <DetailBox position={[-0.2, 0.94, -0.2]} size={[0.18, 0.03, 0.13]} color="#202b23" />
      {[-0.3, 0.3].map((z) => (
        <DetailBox key={z} position={[1.02, 1.79, z]} size={[0.025, 0.14, 0.02]} color="#adb4a9" />
      ))}
    </group>
  );
}

function StreamDetails() {
  return (
    <group>
      <DetailBox
        position={[-0.05, 1.33, 0.42]}
        size={[0.87, 0.5, 0.055]}
        color="#19251f"
        metalness={0.2}
      />
      <mesh position={[-0.05, 1.33, 0.451]}>
        <planeGeometry args={[0.8, 0.425]} />
        <meshStandardMaterial
          color="#253d37"
          emissive="#3e7162"
          emissiveIntensity={0.3}
          roughness={0.3}
        />
      </mesh>
      <DetailBox position={[-0.05, 1.05, 0.42]} size={[0.04, 0.17, 0.04]} />
      <DetailBox position={[-0.05, 0.995, 0.47]} size={[0.28, 0.018, 0.17]} />
      {Array.from({ length: 7 }, (_, i) => (
        <DetailBox
          key={i}
          position={[-0.35 + i * 0.1, 1.3, 0.458]}
          size={[0.035, 0.06 + (i % 4) * 0.055, 0.005]}
          color={i % 2 ? '#91ad83' : '#b5c997'}
          metalness={0}
        />
      ))}
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 11 }, (_, col) => (
          <DetailBox
            key={`${row}-${col}`}
            position={[-0.35 + col * 0.055, 1.012, 0.59 + row * 0.045]}
            size={[0.046, 0.012, 0.033]}
            color={(row + col) % 4 === 0 ? '#808f77' : '#46544b'}
            metalness={0.1}
          />
        )),
      )}
      <mesh position={[0.42, 1.013, 0.72]} scale={[0.047, 0.024, 0.07]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#26382d" roughness={0.55} />
      </mesh>
      {[-0.71, 0.76].map((x) => (
        <group key={x}>
          <DetailBox
            position={[x, 1.16, 0.4]}
            size={[0.16, 0.32, 0.15]}
            color="#27322e"
            metalness={0.05}
          />
          {[1.1, 1.24].map((y) => (
            <mesh key={y} position={[x, y, 0.48]}>
              <torusGeometry args={[0.046, 0.01, 8, 24]} />
              <meshStandardMaterial color="#879780" roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      <DetailBox position={[-0.05, 1.6, 0.43]} size={[0.14, 0.06, 0.07]} color="#25332b" />
      <mesh position={[-0.05, 1.6, 0.467]}>
        <circleGeometry args={[0.019, 24]} />
        <meshPhysicalMaterial color="#1a2926" metalness={0.4} roughness={0.1} clearcoat={1} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0.57, 1.39 + i * 0.025, 0.65]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.072, 0.003, 6, 24]} />
          <meshStandardMaterial color="#293830" metalness={0.65} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroModelDetails({ index }: { index: number }) {
  if (index === 2) return <CarryOnDetails />;
  if (index === 3) return <BillboardDetails />;
  if (index === 4) return <BicycleDetails />;
  if (index === 5) return <StreamDetails />;
  return null;
}
