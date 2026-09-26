'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import AssetModel from './models';
import { heroSpaces } from '@/lib/hero-spaces';
import { defaultSpots } from '@/lib/studio';

const ready = () => {};

function Shirt() {
  const shape = useMemo(() => {
    const path = new THREE.Shape();
    path.moveTo(-0.46, 1.3);
    path.lineTo(-1, 0.98);
    path.lineTo(-1.38, 0.2);
    path.lineTo(-0.92, -0.04);
    path.lineTo(-0.66, 0.39);
    path.lineTo(-0.78, -1.28);
    path.lineTo(0.78, -1.28);
    path.lineTo(0.66, 0.39);
    path.lineTo(0.92, -0.04);
    path.lineTo(1.38, 0.2);
    path.lineTo(1, 0.98);
    path.lineTo(0.46, 1.3);
    path.quadraticCurveTo(0, 0.81, -0.46, 1.3);
    return path;
  }, []);
  return (
    <group>
      <mesh>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.13,
              bevelEnabled: true,
              bevelSegments: 3,
              steps: 1,
              bevelSize: 0.035,
              bevelThickness: 0.035,
            },
          ]}
        />
        <meshStandardMaterial color="#b9c6a1" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.04, 0.171]}>
        <planeGeometry args={[0.92, 0.65]} />
        <meshStandardMaterial color="#d7f76a" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.04, 0.176]}>
        <planeGeometry args={[0.19, 0.018]} />
        <meshBasicMaterial color="#425d30" />
      </mesh>
      <mesh position={[0, 0.04, 0.177]}>
        <planeGeometry args={[0.018, 0.19]} />
        <meshBasicMaterial color="#425d30" />
      </mesh>
    </group>
  );
}

function Model({
  index,
  playing,
  reducedMotion,
  onReady,
}: {
  index: number;
  playing: boolean;
  reducedMotion: boolean;
  onReady: (index: number) => void;
}) {
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    onReady(index);
  }, [index, onReady]);
  const { camera, size, invalidate } = useThree();
  const frameModel = useCallback(
    ({ width, height, depth }: { width: number; height: number; depth: number }) => {
      if (!(camera instanceof THREE.PerspectiveCamera)) return;
      // Fill the stage for each silhouette, allowing for its turn during the entrance.
      const horizontalExtent = width + depth * 0.61;
      const nearDistance = Math.max(1, camera.position.z - (depth + width * 0.61) / 2);
      const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * nearDistance;
      camera.zoom =
        0.94 *
        visibleHeight *
        Math.min(
          1 / Math.max(height, 0.01),
          size.width / size.height / Math.max(horizontalExtent, 0.01),
        );
      // The livestream's deep floor makes its bounds much larger than its visible backdrop.
      if (heroSpaces[index].kind === 'twitch') camera.zoom *= 1.3;
      camera.updateProjectionMatrix();
      invalidate();
    },
    [camera, size.width, size.height, invalidate, index],
  );
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!root.current) return;
    elapsed.current += Math.min(delta, 0.05);
    const entrance = reducedMotion ? 1 : Math.min(elapsed.current / 0.65, 1);
    if (entrance < 1) invalidate();
    const ease = 1 - Math.pow(1 - entrance, 3);
    root.current.scale.setScalar(0.92 + ease * 0.08);
    root.current.position.y = (1 - ease) * -0.18;
    root.current.rotation.y =
      -0.25 + (1 - ease) * -0.4 + (playing ? Math.sin(elapsed.current * 0.5) * 0.16 : 0);
  });
  const spot = index > 1 ? defaultSpots(heroSpaces[index].kind)[0] : null;
  return (
    <group ref={root} rotation={[0, -0.25, 0]}>
      <Center onCentered={frameModel}>
        {index === 0 ? (
          <Shirt />
        ) : (
          <group>
            <AssetModel
              kind={heroSpaces[index].kind}
              humanPreset={heroSpaces[index].humanPreset}
              color="#b4bea7"
              onReady={ready}
            />
            {spot && (
              <mesh position={spot.position} rotation={spot.rotation}>
                <planeGeometry args={[spot.width, spot.height]} />
                <meshStandardMaterial
                  color="#d7f76a"
                  side={THREE.DoubleSide}
                  roughness={0.6}
                  polygonOffset
                  polygonOffsetFactor={-4}
                />
              </mesh>
            )}
          </group>
        )}
      </Center>
    </group>
  );
}

export default function HeroShowcaseScene({
  index,
  playing,
  reducedMotion,
  onReady,
}: {
  index: number;
  playing: boolean;
  reducedMotion: boolean;
  onReady: (index: number) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 6.1], fov: 37 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      frameloop={playing ? 'always' : 'demand'}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 5, 5]} intensity={3} />
      <directionalLight position={[-4, 1, 2]} intensity={1} color="#e6eddc" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 3]} scale={[6, 4, 1]} />
        <Lightformer
          form="rect"
          intensity={2}
          position={[-4, 2, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[3, 5, 1]}
        />
      </Environment>
      <Suspense fallback={null}>
        <Model
          key={index}
          index={index}
          playing={playing}
          reducedMotion={reducedMotion}
          onReady={onReady}
        />
      </Suspense>
    </Canvas>
  );
}
