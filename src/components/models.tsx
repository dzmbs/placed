'use client';
import { useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AssetKind, HumanPresetId } from '@/lib/types';
import { humanModelUrl, humanWardrobe, type HumanWardrobe } from '@/lib/humans';
import { prepareImportedScene } from '@/lib/model-scene';
import { assembleWardrobe } from '@/lib/wardrobe-scene';
import { XBanner, TwitchBackground, Billboard } from './ad-space-models';

function Box({
  position,
  size,
  color,
  radius = 0.06,
  metalness = 0.1,
  roughness = 0.6,
  name,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  radius?: number;
  metalness?: number;
  roughness?: number;
  name?: string;
}) {
  return (
    <RoundedBox
      name={name}
      args={size}
      position={position}
      radius={radius}
      smoothness={4}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </RoundedBox>
  );
}
function Tube({
  from,
  to,
  radius = 0.035,
  color = '#27382b',
  metalness = 0.5,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius?: number;
  color?: string;
  metalness?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      diff = b.clone().sub(a);
    return {
      position: a.add(b).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        diff.clone().normalize(),
      ),
      length: diff.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={0.3} />
    </mesh>
  );
}
export function Backpack({ color }: { color: string }) {
  return (
    <group>
      <Box
        name="pack-shell"
        position={[0, 1.42, 0]}
        size={[1.36, 2.18, 0.88]}
        color={color}
        radius={0.3}
        roughness={0.9}
      />
      <Box
        name="pack-pocket"
        position={[0, 1.0, 0.42]}
        size={[1.05, 0.85, 0.28]}
        color={color}
        radius={0.13}
        roughness={0.85}
      />
      <Box position={[0, 1.4, 0.57]} size={[0.91, 0.03, 0.04]} color="#2d352d" radius={0.013} />
      <Box
        position={[0.37, 1.36, 0.6]}
        size={[0.04, 0.14, 0.025]}
        color="#343c32"
        radius={0.01}
        metalness={0.7}
      />
      {[-0.45, 0.45].map((x) => (
        <group key={x}>
          <Box position={[x, 1.3, -0.49]} size={[0.18, 1.88, 0.11]} color="#323b31" radius={0.06} />
          <Box
            position={[x * 1.5, 1.05, 0]}
            size={[0.17, 0.7, 0.57]}
            color="#3f493b"
            radius={0.07}
          />
        </group>
      ))}
      <Tube from={[-0.23, 2.42, 0]} to={[-0.23, 2.64, 0]} radius={0.045} color="#293629" />
      <Tube from={[0.23, 2.42, 0]} to={[0.23, 2.64, 0]} radius={0.045} color="#293629" />
      <Box position={[0, 2.63, 0]} size={[0.54, 0.09, 0.11]} color="#293629" radius={0.035} />
    </group>
  );
}
export function Dress({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const points = [
      [0.57, 0.09],
      [0.6, 0.13],
      [0.53, 0.45],
      [0.44, 0.9],
      [0.35, 1.29],
      [0.28, 1.58],
      [0.26, 1.69],
      [0.32, 1.96],
      [0.31, 2.11],
    ].map((p) => new THREE.Vector2(p[0], p[1]));
    const geo = new THREE.LatheGeometry(points, 72);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i),
        angle = Math.atan2(p.getZ(i), p.getX(i));
      const fold = 1 + Math.cos(angle * 18) * 0.016 * (1 - Math.min(y / 1.8, 1));
      p.setX(i, p.getX(i) * fold);
      p.setZ(i, p.getZ(i) * fold * 0.83);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  const skin = '#a48f79';
  return (
    <group>
      <mesh name="dress" geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={color}
          roughness={0.51}
          metalness={0.05}
          sheen={0.7}
          sheenColor="#e9e0d1"
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2.43, 0]} scale={[0.17, 0.225, 0.17]} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial color={skin} roughness={0.65} />
      </mesh>
      <Tube from={[0, 2.12, 0]} to={[0, 2.28, 0]} radius={0.085} color={skin} metalness={0} />
      <Box position={[0, 2.13, 0]} size={[0.7, 0.13, 0.27]} color={skin} radius={0.06} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Tube
            from={[side * 0.36, 2.13, 0]}
            to={[side * 0.53, 1.74, 0.01]}
            radius={0.055}
            color={skin}
            metalness={0}
          />
          <Tube
            from={[side * 0.53, 1.74, 0.01]}
            to={[side * 0.57, 1.35, 0.03]}
            radius={0.042}
            color={skin}
            metalness={0}
          />
          <mesh position={[side * 0.58, 1.29, 0.03]} scale={[0.045, 0.09, 0.04]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export function Bicycle({ color }: { color: string }) {
  const back: [number, number, number] = [-1.14, 0.66, 0],
    front: [number, number, number] = [1.14, 0.66, 0];
  const crank: [number, number, number] = [-0.2, 0.7, 0],
    seat: [number, number, number] = [-0.56, 1.74, 0],
    head: [number, number, number] = [0.79, 1.7, 0];
  return (
    <group>
      {[back, front].map((p, i) => (
        <group position={p} key={i}>
          <mesh castShadow>
            <torusGeometry args={[0.61, 0.043, 12, 80]} />
            <meshStandardMaterial color="#242921" roughness={0.8} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.573, 0.022, 8, 80]} />
            <meshStandardMaterial color="#99a28d" metalness={0.8} roughness={0.3} />
          </mesh>
          {Array.from({ length: 20 }, (_, i) => {
            const a = (i / 20) * Math.PI * 2;
            return (
              <Tube
                key={i}
                from={[0, 0, 0]}
                to={[Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0]}
                radius={0.004}
                color="#98a18e"
              />
            );
          })}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.16, 16]} />
            <meshStandardMaterial color="#555f4e" metalness={0.7} />
          </mesh>
        </group>
      ))}
      {[
        [back, seat],
        [back, crank],
        [crank, seat],
        [seat, head],
        [head, crank],
        [head, front],
      ].map(([a, b], i) => (
        <Tube key={i} from={a} to={b} radius={i === 4 ? 0.055 : 0.033} color={color} />
      ))}
      <Tube from={seat} to={[-0.62, 1.94, 0]} radius={0.025} color="#858e7d" />
      <Box position={[-0.62, 1.97, 0]} size={[0.4, 0.06, 0.17]} color="#1c241a" radius={0.025} />
      <Tube from={head} to={[0.88, 1.96, 0]} radius={0.028} color="#4a5441" />
      <Tube from={[0.88, 1.96, -0.28]} to={[0.88, 1.96, 0.28]} radius={0.023} color="#2b3424" />
      {[-0.28, 0.28].map((z) => (
        <Tube key={z} from={[0.88, 1.96, z]} to={[1.04, 1.7, z]} radius={0.023} color="#2b3424" />
      ))}
      <mesh position={crank}>
        <torusGeometry args={[0.135, 0.013, 8, 32]} />
        <meshStandardMaterial color="#717c61" metalness={0.7} />
      </mesh>
      <Tube from={[-0.2, 0.7, 0.12]} to={[-0.2, 0.45, 0.12]} radius={0.018} color="#818b74" />
      <Box position={[-0.2, 0.45, 0.17]} size={[0.19, 0.025, 0.12]} color="#26301f" radius={0.01} />
    </group>
  );
}
export function Digital({ color }: { color: string }) {
  return (
    <group>
      <Box
        name="screen"
        position={[0, 1.6, 0]}
        size={[2.8, 1.16, 0.16]}
        color={color}
        radius={0.06}
        metalness={0.5}
      />
      <Box position={[0, 1.6, 0.085]} size={[2.62, 0.98, 0.015]} color="#26322c" radius={0.02} />
      <Tube from={[0, 0.17, 0]} to={[0, 1.03, 0]} radius={0.045} color="#707c64" />
      <Box
        position={[0, 0.1, 0]}
        size={[0.8, 0.08, 0.48]}
        color="#5b6751"
        radius={0.03}
        metalness={0.6}
      />
    </group>
  );
}
function CuratedCarryOn({ color }: { color: string }) {
  const gltf = useGLTF('/models/carry-on.glb');
  const { scene, materials } = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const materials = new Map<THREE.Material, THREE.Material>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const customize = (original: THREE.Material) => {
        if (!materials.has(original)) {
          const clone = original.clone();
          if (clone.name === 'Shell' && clone instanceof THREE.MeshStandardMaterial)
            clone.color.set(color);
          materials.set(original, clone);
        }
        return materials.get(original)!;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(customize)
        : customize(object.material);
    });
    return { scene, materials };
  }, [gltf.scene, color]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);
  return <primitive object={scene} dispose={null} />;
}
function Imported({ url }: { url: string }) {
  const gltf = useGLTF(url, '/draco/');
  const scene = useMemo(() => {
    return prepareImportedScene(gltf.scene);
  }, [gltf.scene]);
  return <primitive object={scene} dispose={null} />;
}
function Wardrobe({ definition }: { definition: HumanWardrobe }) {
  const body = useGLTF(definition.bodyUrl, '/draco/');
  const outfits = useGLTF(definition.outfitUrls, '/draco/');
  const scene = useMemo(
    () =>
      assembleWardrobe(
        body.scene,
        outfits.map((outfit) => outfit.scene),
        definition,
      ),
    [body.scene, outfits, definition],
  );
  return <primitive object={scene} dispose={null} />;
}
function ModelContent({
  kind,
  color,
  url,
  humanPreset,
}: {
  kind: AssetKind;
  color: string;
  url?: string;
  humanPreset?: HumanPresetId;
}) {
  if (kind === 'dress' && humanPreset) {
    const wardrobe = humanWardrobe(humanPreset);
    return wardrobe ? (
      <Wardrobe definition={wardrobe} />
    ) : (
      <Imported url={humanModelUrl(humanPreset)} />
    );
  }
  if (kind === 'custom' && url) return <Imported url={url} />;
  if (kind === 'x-banner') return <XBanner color={color} />;
  if (kind === 'twitch') return <TwitchBackground color={color} />;
  if (kind === 'billboard') return <Billboard color={color} />;
  if (kind === 'backpack') return <Backpack color={color} />;
  if (kind === 'dress') return <Dress color={color} />;
  if (kind === 'bicycle') return <Bicycle color={color} />;
  if (kind === 'digital') return <Digital color={color} />;
  return <CuratedCarryOn color={color} />;
}

export default function AssetModel(
  props: Parameters<typeof ModelContent>[0] & { onReady: () => void },
) {
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    let index = 0;
    root.current?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!object.name) object.name = `template-surface-${index}`;
      index++;
    });
    props.onReady();
  }, [props.kind, props.url, props.humanPreset, props.color, props.onReady]);
  return (
    <group ref={root}>
      <ModelContent {...props} />
    </group>
  );
}
