'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
  RoundedBox,
  useTexture,
} from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as THREE from 'three';
import AssetModel from './models';
import type { Draft, Spot, Vec3 } from '@/lib/types';
import { money } from '@/lib/studio';
import { humanWardrobe } from '@/lib/humans';

export type CameraCommand = { view: 'front' | 'back' | 'side' | 'iso' | 'spot'; nonce: number };
export interface ViewerProps {
  draft: Draft;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  placing: boolean;
  onPlace: (position: Vec3, rotation: Vec3, meshName: string) => void;
  command: CameraCommand;
  autoRotate: boolean;
  showSpots: boolean;
  preview: boolean;
  exportNonce: number;
  onError: (message: string) => void;
}
class SceneBoundary extends Component<
  { children: React.ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError(
      'This model could not be displayed. Try a self-contained GLB or another template.',
    );
  }
  render() {
    return this.state.failed ? (
      <div className="viewer-loading">
        Model unavailable. Choose another canvas or import a GLB.
      </div>
    ) : (
      this.props.children
    );
  }
}
function slotTexture(
  spot: Spot,
  selected: boolean,
  hover: boolean,
  index: number,
  preview: boolean,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(128, Math.min(2048, Math.round((1024 * spot.height) / spot.width)));
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width,
    h = canvas.height;
  ctx.fillStyle = preview ? '#e8eadd' : selected || hover ? '#d7f76a' : '#e8ebdf';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = selected ? '#61792f' : '#818c73';
  ctx.lineWidth = 5;
  ctx.setLineDash(selected ? [] : [14, 10]);
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.setLineDash([]);
  ctx.fillStyle = '#526047';
  ctx.font = '500 34px monospace';
  ctx.fillText(String(index + 1).padStart(2, '0'), 38, 54);
  ctx.fillStyle = '#26341e';
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.min(110, h * 0.24)}px sans-serif`;
  ctx.fillText(preview ? 'YOUR BRAND' : money(spot.price), w / 2, h / 2 + 25);
  ctx.fillStyle = '#617050';
  ctx.font = `${Math.min(28, h * 0.065)}px monospace`;
  ctx.fillText(preview ? 'THIS COULD BE YOU' : 'AVAILABLE', w / 2, h - 35);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function ArtworkMaterial({ url, width, height }: { url: string; width: number; height: number }) {
  const source = useTexture(url);
  const map = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.min(2048, Math.round((1024 * height) / width)));
    const image = source.image as HTMLImageElement;
    const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
    canvas
      .getContext('2d')!
      .drawImage(
        image,
        (canvas.width - image.width * scale) / 2,
        (canvas.height - image.height * scale) / 2,
        image.width * scale,
        image.height * scale,
      );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [source, width, height]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <meshStandardMaterial
      map={map}
      color="#ffffff"
      transparent
      roughness={0.6}
      polygonOffset
      polygonOffsetFactor={-4}
      side={THREE.DoubleSide}
    />
  );
}
function SpotPatch({
  spot,
  index,
  selected,
  preview,
  onSelect,
  assetRoot,
  surfaceRevision,
}: {
  spot: Spot;
  index: number;
  selected: boolean;
  preview: boolean;
  onSelect: (id: string) => void;
  assetRoot: React.RefObject<THREE.Group | null>;
  surfaceRevision: number;
}) {
  const [hover, setHover] = useState(false);
  const texture = useMemo(
    () => slotTexture(spot, selected, hover, index, preview),
    [spot, selected, hover, index, preview],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    if (!spot.projection || !spot.meshName || !assetRoot.current) return;
    const root = assetRoot.current;
    root.updateWorldMatrix(true, true);
    const mesh = root.getObjectByName(spot.meshName);
    if (!(mesh instanceof THREE.Mesh)) {
      setGeometry(null);
      return;
    }
    const point = root.localToWorld(new THREE.Vector3(...spot.position));
    const world = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(...spot.rotation))
      .premultiply(root.getWorldQuaternion(new THREE.Quaternion()));
    const geometry = new DecalGeometry(
      mesh,
      point,
      new THREE.Euler().setFromQuaternion(world),
      new THREE.Vector3(spot.width, spot.height, 0.22),
    );
    geometry.applyMatrix4(root.matrixWorld.clone().invert());
    setGeometry(geometry);
    return () => geometry.dispose();
  }, [
    spot.position,
    spot.rotation,
    spot.width,
    spot.height,
    spot.meshName,
    spot.projection,
    assetRoot,
    surfaceRevision,
  ]);
  const material = spot.artwork ? (
    <Suspense fallback={<meshStandardMaterial map={texture} />}>
      <ArtworkMaterial url={spot.artwork} width={spot.width} height={spot.height} />
    </Suspense>
  ) : (
    <meshStandardMaterial
      map={texture}
      roughness={0.63}
      metalness={0.03}
      polygonOffset
      polygonOffsetFactor={-4}
    />
  );
  const events = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.delta < 5) onSelect(spot.id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHover(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHover(false);
      document.body.style.cursor = '';
    },
  };
  if (spot.projection && geometry)
    return (
      <mesh geometry={geometry} {...events} renderOrder={3}>
        {material}
      </mesh>
    );
  return (
    <group position={spot.position} rotation={spot.rotation}>
      <RoundedBox
        args={[spot.width, spot.height, 0.012]}
        radius={0.018}
        smoothness={3}
        {...events}
        renderOrder={3}
      >
        <meshStandardMaterial color={selected ? '#d7f76a' : '#edf0e5'} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0, 0.008]} {...events} renderOrder={4}>
        <planeGeometry args={[spot.width - 0.012, spot.height - 0.012]} />
        {material}
      </mesh>
    </group>
  );
}
function Scene(props: ViewerProps) {
  const [surfaceRevision, setSurfaceRevision] = useState(0);
  const modelReady = useCallback(() => setSurfaceRevision((revision) => revision + 1), []);
  const root = useRef<THREE.Group>(null);
  const modelRoot = useRef<THREE.Group>(null);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const target = useRef<{ position: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  const lastExport = useRef(0);
  useEffect(() => {
    const look = new THREE.Vector3(0, 1.4, 0);
    let position = new THREE.Vector3(3.6, 2.9, 6);
    if (props.command.view === 'front') position.set(0, 1.7, 6.3);
    if (props.command.view === 'back') position.set(0, 1.7, -6.3);
    if (props.command.view === 'side') position.set(6.3, 1.8, 0);
    if (props.command.view === 'spot') {
      const spot = props.draft.spots.find((s) => s.id === props.selectedId);
      if (spot) {
        look.set(...spot.position);
        const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...spot.rotation));
        position.copy(look).addScaledVector(normal, Math.max(2.1, spot.width * 2.7));
        position.y += 0.25;
      }
    }
    target.current = { position, look };
    // Selecting a spot should move the camera only when requested, not while editing its fields.
  }, [props.command.nonce]);
  useFrame((_, delta) => {
    if (!target.current || !controls.current) return;
    const amount = 1 - Math.exp(-delta * 6);
    camera.position.lerp(target.current.position, amount);
    controls.current.target.lerp(target.current.look, amount);
    controls.current.update();
    if (
      camera.position.distanceTo(target.current.position) < 0.008 &&
      controls.current.target.distanceTo(target.current.look) < 0.008
    )
      target.current = null;
  });
  useEffect(() => {
    if (!props.exportNonce || lastExport.current === props.exportNonce || !root.current) return;
    lastExport.current = props.exportNonce;
    const exporter = new GLTFExporter();
    exporter
      .parseAsync(root.current, { binary: true })
      .then((result) => {
        const url = URL.createObjectURL(
          new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }),
        );
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'placed-model.glb';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .catch(() =>
        props.onError('The model could not be exported. Try saving your campaign JSON instead.'),
      );
  }, [props.exportNonce, props.onError]);
  useEffect(() => {
    gl.domElement.style.cursor = props.placing ? 'crosshair' : '';
  }, [props.placing, gl]);
  function place(event: ThreeEvent<MouseEvent>) {
    if (
      !props.placing ||
      !root.current ||
      event.delta > 5 ||
      !(event.object instanceof THREE.Mesh) ||
      !event.face
    )
      return;
    event.stopPropagation();
    root.current.updateWorldMatrix(true, true);
    const position = root.current.worldToLocal(event.point.clone());
    const normal = event.face.normal
      .clone()
      .transformDirection(event.object.matrixWorld)
      .transformDirection(root.current.matrixWorld.clone().invert());
    const euler = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    );
    if (!event.object.name) event.object.name = `surface-${event.object.id}`;
    props.onPlace(position.toArray() as Vec3, [euler.x, euler.y, euler.z], event.object.name);
  }
  return (
    <>
      <color attach="background" args={['#101914']} />
      <fog attach="fog" args={['#101914', 10, 24]} />
      <ambientLight intensity={0.3} />
      <spotLight
        position={[3, 7, 4]}
        intensity={100}
        angle={0.5}
        penumbra={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-4, 2, -3]} intensity={22} color="#c9ddad" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3}
          position={[0, 5, -2]}
          scale={[6, 3, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[-4, 2, 2]}
          scale={[3, 6, 1]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          position={[4, 3, 1]}
          scale={[2, 5, 1]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      </Environment>
      <group position={[0, -0.16, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[2.03, 2.07, 0.22, 96]} />
          <meshStandardMaterial color="#303c31" roughness={0.36} metalness={0.55} />
        </mesh>
        <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.94, 1.96, 96]} />
          <meshBasicMaterial color="#a0b479" transparent opacity={0.45} />
        </mesh>
        <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.93, 96]} />
          <meshStandardMaterial color="#283329" roughness={0.5} metalness={0.25} />
        </mesh>
      </group>
      <mesh receiveShadow position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#101914" roughness={0.85} />
      </mesh>
      <ContactShadows
        position={[0, -0.025, 0]}
        opacity={0.45}
        scale={7}
        blur={2.5}
        far={4}
        resolution={256}
        frames={1}
      />
      <group ref={root}>
        <group ref={modelRoot} onClick={place}>
          <Suspense fallback={null}>
            <AssetModel
              kind={props.draft.asset}
              color={props.draft.color}
              url={props.draft.assetUrl}
              humanPreset={props.draft.humanPreset}
              onReady={modelReady}
            />
          </Suspense>
        </group>
        {(props.showSpots || props.preview) &&
          props.draft.spots.map((spot, index) => (
            <SpotPatch
              key={spot.id}
              spot={spot}
              index={index}
              selected={!props.preview && props.selectedId === spot.id}
              preview={props.preview}
              onSelect={props.placing ? () => {} : props.onSelect}
              assetRoot={root}
              surfaceRevision={surfaceRevision}
            />
          ))}
      </group>
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 1.4, 0]}
        minDistance={1.7}
        maxDistance={10}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 + 0.08}
        enablePan={false}
        autoRotate={props.autoRotate && !props.placing}
        autoRotateSpeed={0.45}
        onStart={() => {
          target.current = null;
        }}
      />
    </>
  );
}
export default function Viewer(props: ViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const bodyKey = props.draft.humanPreset
    ? (humanWardrobe(props.draft.humanPreset)?.bodyUrl ?? props.draft.humanPreset)
    : '';
  return (
    <div className="canvas-wrap">
      {!loaded && (
        <div className="viewer-loading">
          <span className="spinner" />
          Setting the stage…
        </div>
      )}
      <SceneBoundary
        key={`${props.draft.asset}-${props.draft.assetUrl}-${bodyKey}`}
        onError={props.onError}
      >
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [3.6, 2.9, 6], fov: 36 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          onCreated={() => setLoaded(true)}
        >
          <Scene {...props} />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
