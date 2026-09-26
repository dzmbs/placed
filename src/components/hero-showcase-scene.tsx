'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Center, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import AssetModel from './models';
import HeroModelDetails, { HeroShirt } from './hero-model-details';
import { heroSpaces, type HeroPlacement, type ProjectPlacement } from '@/lib/hero-spaces';

const ready = () => {};

function Placement({
  index,
  placement,
  onProject,
}: {
  index: number;
  placement: HeroPlacement;
  onProject: ProjectPlacement;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.round((1024 * placement.size[1]) / placement.size[0]));
    const context = canvas.getContext('2d')!;
    context.fillStyle = placement.booked ? '#314839' : '#d7f76a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = placement.booked ? '#f5f5ec' : '#314839';
    const fontSize = Math.min(
      canvas.height * 0.3,
      canvas.width / (placement.artwork.length * 0.65),
    );
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(placement.artwork, canvas.width / 2, canvas.height / 2, canvas.width * 0.88);
    const artwork = new THREE.CanvasTexture(canvas);
    artwork.colorSpace = THREE.SRGBColorSpace;
    return artwork;
  }, [placement]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (!mesh.current) return;
    const [width, height] = placement.size;
    const corners: [number, number][] = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ].map(([x, y]) => {
      point.set((x * width) / 2, (y * height) / 2, 0);
      mesh.current!.localToWorld(point).project(camera);
      return [(point.x + 1) * 50, (1 - point.y) * 50];
    });
    onProject(index, placement.id, corners);
  });
  return (
    <mesh ref={mesh} position={placement.position} rotation={placement.rotation}>
      <planeGeometry args={placement.size} />
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-4}
      />
    </mesh>
  );
}

function Model({
  index,
  playing,
  reducedMotion,
  onReady,
  onProject,
}: {
  index: number;
  playing: boolean;
  reducedMotion: boolean;
  onReady: (index: number) => void;
  onProject: ProjectPlacement;
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
        0.97 *
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
  return (
    <group ref={root} rotation={[0, -0.25, 0]}>
      <Center onCentered={frameModel}>
        {index === 0 ? (
          <HeroShirt />
        ) : (
          <group>
            <AssetModel
              kind={heroSpaces[index].kind}
              humanPreset={heroSpaces[index].humanPreset}
              color="#a6b397"
              onReady={ready}
            />
            <HeroModelDetails index={index} />
          </group>
        )}
        {heroSpaces[index].placements.map((placement) => (
          <Placement key={placement.id} index={index} placement={placement} onProject={onProject} />
        ))}
      </Center>
    </group>
  );
}

export default function HeroShowcaseScene({
  index,
  playing,
  reducedMotion,
  onReady,
  onProject,
}: {
  index: number;
  playing: boolean;
  reducedMotion: boolean;
  onReady: (index: number) => void;
  onProject: ProjectPlacement;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 6.1], fov: 37 }}
      dpr={[1, 2]}
      shadows={{ type: THREE.PCFShadowMap }}
      gl={{ alpha: true, antialias: true }}
      frameloop={playing ? 'always' : 'demand'}
    >
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[3, 5, 5]}
        intensity={2.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-normalBias={0.035}
      />
      <directionalLight position={[-4, 1, 2]} intensity={0.7} color="#e6eddc" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 3]} scale={[6, 4, 1]} />
        <Lightformer
          form="rect"
          intensity={2}
          position={[-4, 2, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[3, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={3}
          position={[3, 1, -2]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[2, 4, 1]}
        />
      </Environment>
      <Suspense fallback={null}>
        <Model
          key={index}
          index={index}
          playing={playing}
          reducedMotion={reducedMotion}
          onReady={onReady}
          onProject={onProject}
        />
      </Suspense>
    </Canvas>
  );
}
