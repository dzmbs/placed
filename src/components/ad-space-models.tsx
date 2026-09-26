'use client';

import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from '@/lib/types';

function Panel({
  position,
  size,
  color,
  name,
  glow = false,
}: {
  position: Vec3;
  size: Vec3;
  color: string;
  name?: string;
  glow?: boolean;
}) {
  return (
    <RoundedBox
      name={name}
      args={size}
      position={position}
      radius={Math.min(0.035, ...size.map((dimension) => dimension / 3))}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.15}
        emissive={glow ? color : '#000000'}
        emissiveIntensity={glow ? 1.6 : 0}
      />
    </RoundedBox>
  );
}

// Local canvas textures keep the preview and exported model self-contained.
function Label({
  text,
  position,
  width,
  color = '#d8e0d1',
}: {
  text: string;
  position: Vec3;
  width: number;
  color?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = color;
    context.font = '500 64px Arial, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(text, 6, 64, 1012);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={[width, width / 8]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function XBanner({ color }: { color: string }) {
  return (
    <group>
      <Panel name="profile-frame" position={[0, 1.45, 0]} size={[3.16, 2.82, 0.16]} color={color} />
      <Panel
        name="profile-body"
        position={[0, 1.43, 0.086]}
        size={[3.02, 2.64, 0.03]}
        color="#101715"
      />
      <Panel
        name="profile-header"
        position={[0, 2.2, 0.113]}
        size={[3.02, 1.02, 0.03]}
        color="#527576"
      />
      <mesh name="profile-avatar-rim" position={[-1.13, 1.69, 0.176]}>
        <circleGeometry args={[0.265, 48]} />
        <meshStandardMaterial color="#101715" />
      </mesh>
      <mesh name="profile-avatar" position={[-1.13, 1.69, 0.183]}>
        <circleGeometry args={[0.235, 48]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-1.13, 1.74, 0.189]}>
        <circleGeometry args={[0.065, 32]} />
        <meshBasicMaterial color="#314337" />
      </mesh>
      <mesh position={[-1.13, 1.59, 0.189]} scale={[1, 0.7, 1]}>
        <circleGeometry args={[0.12, 32]} />
        <meshBasicMaterial color="#314337" />
      </mesh>
      <Panel position={[1.05, 1.46, 0.123]} size={[0.66, 0.22, 0.018]} color="#d5e1cd" />
      <Label text="Follow" position={[1.55, 1.46, 0.138]} width={1.3} color="#23362b" />
      <Label text="Your name" position={[-0.2, 1.16, 0.121]} width={2.4} />
      <Label text="@yourhandle" position={[-0.42, 0.94, 0.121]} width={1.96} color="#81988a" />
      <Label text="Your world. Your next sponsor." position={[-0.15, 0.67, 0.121]} width={2.5} />
      <Panel position={[-0.25, 0.43, 0.117]} size={[2.3, 0.012, 0.006]} color="#34473b" />
      <Label
        text="Posts                 Replies                 Media"
        position={[0, 0.25, 0.121]}
        width={2.8}
        color="#93a88b"
      />
    </group>
  );
}

export function TwitchBackground({ color }: { color: string }) {
  return (
    <group>
      <Panel
        name="stream-wall"
        position={[0, 1.49, -0.25]}
        size={[3.5, 2.35, 0.18]}
        color="#252832"
      />
      <Panel name="stream-floor" position={[0, 0.3, 0.4]} size={[3.5, 0.08, 1.5]} color="#242c28" />
      <Panel position={[0, 2.61, -0.139]} size={[3.36, 0.025, 0.025]} color="#a17bdf" glow />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Panel
            position={[side * 1.7, 1.5, -0.14]}
            size={[0.025, 2.2, 0.025]}
            color="#8360ce"
            glow
          />
          <Panel
            name={`stream-sponsor-${side}`}
            position={[side * 1.05, 1.97, -0.138]}
            size={[1.04, 0.65, 0.045]}
            color={color}
          />
          {[0.69, 1.35].map((height) => (
            <group key={height}>
              <Panel
                position={[side * 1.08, height, -0.015]}
                size={[0.99, 0.045, 0.4]}
                color="#566044"
              />
              <Panel
                position={[side * 1.08, height - 0.028, 0.17]}
                size={[0.85, 0.014, 0.014]}
                color="#9670d2"
                glow
              />
              {[0, 1, 2, 3].map((book) => (
                <Panel
                  key={book}
                  position={[side * 1.08 + (book - 1.5) * 0.105, height + 0.16, -0.045]}
                  size={[0.075, 0.26 + book * 0.02, 0.16]}
                  color={['#59674f', '#a39278', '#77698d', '#8e9e80'][book]}
                />
              ))}
            </group>
          ))}
        </group>
      ))}
      <Label
        text="LIVE  /  YOUR CHANNEL"
        position={[-0.36, 2.46, -0.14]}
        width={2.48}
        color="#cdb4fb"
      />
      <Panel
        name="stream-chair"
        position={[0, 1.23, 0.13]}
        size={[0.7, 1.12, 0.22]}
        color="#3a304b"
      />
      <Panel position={[0, 1.65, 0.254]} size={[0.46, 0.18, 0.035]} color="#776095" />
      <Panel position={[0, 0.57, 0.35]} size={[0.8, 0.14, 0.57]} color="#362d45" />
      <Panel
        name="stream-desk"
        position={[0, 0.94, 0.65]}
        size={[2.2, 0.085, 0.57]}
        color={color}
      />
      <Panel
        name="stream-desk-front"
        position={[0, 0.74, 0.825]}
        size={[1.83, 0.38, 0.08]}
        color="#26382c"
      />
      {[-0.92, 0.92].map((x) => (
        <Panel key={x} position={[x, 0.61, 0.62]} size={[0.075, 0.59, 0.075]} color="#242c28" />
      ))}
      <Panel position={[-0.05, 0.995, 0.66]} size={[0.68, 0.023, 0.2]} color="#252831" />
      <Panel position={[0.57, 1.21, 0.65]} size={[0.04, 0.49, 0.04]} color="#1b201e" />
      <Panel position={[0.57, 1.47, 0.65]} size={[0.14, 0.26, 0.14]} color="#576556" />
    </group>
  );
}

export function Billboard({ color }: { color: string }) {
  return (
    <group>
      {[-1, 1].map((x) => (
        <group key={x}>
          <Panel
            name={`billboard-post-${x}`}
            position={[x, 0.75, -0.07]}
            size={[0.15, 1.5, 0.2]}
            color="#5b6862"
          />
          <Panel position={[x, 0.04, -0.07]} size={[0.44, 0.08, 0.54]} color="#7c8077" />
        </group>
      ))}
      <Panel
        name="billboard-frame"
        position={[0, 2.05, 0]}
        size={[3.36, 1.56, 0.23]}
        color={color}
      />
      <Panel
        name="billboard-face"
        position={[0, 2.05, 0.12]}
        size={[3.2, 1.4, 0.025]}
        color="#e4e7d7"
      />
      {[1.45, 2.58].map((height) => (
        <Panel
          key={height}
          position={[0, height, -0.18]}
          size={[3.15, 0.075, 0.1]}
          color="#485951"
        />
      ))}
      {[-1.28, -0.43, 0.43, 1.28].map((x) => (
        <group key={x}>
          <Panel position={[x, 2.85, 0]} size={[0.035, 0.19, 0.035]} color="#56665c" />
          <Panel position={[x, 2.94, 0.16]} size={[0.035, 0.035, 0.35]} color="#56665c" />
          <Panel position={[x, 2.91, 0.33]} size={[0.23, 0.055, 0.13]} color="#273d30" />
          <Panel position={[x, 2.881, 0.33]} size={[0.19, 0.01, 0.095]} color="#e2e6bd" glow />
        </group>
      ))}
      <Panel position={[0, 1.2, 0.24]} size={[3.43, 0.055, 0.42]} color="#5b6862" />
    </group>
  );
}
