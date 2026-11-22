import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, Outlines, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { BCH_COIN } from '../lib/bchCoin';

const INK = '#111111';
const GREEN = '#0ac18e';

/** The official BCH coin, rendered from its own SVG geometry into a texture (face of the 3D coin). */
function useCoinTexture(): THREE.Texture | undefined {
  const [tex, setTex] = useState<THREE.Texture>();
  useEffect(() => {
    const { viewBox, cx, cy, r, bPath, green } = BCH_COIN;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewBox}"><circle fill="${green}" cx="${cx}" cy="${cy}" r="${r}"/><path fill="#fff" d="${bPath}"/></svg>`;
    const img = new Image();
    let t: THREE.CanvasTexture | undefined;
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      c.getContext('2d')?.drawImage(img, 0, 0, 1024, 1024);
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      setTex(t);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => t?.dispose();
  }, []);
  return tex;
}

/** 3-step toon ramp so shading reads as flat inked bands. */
function useToonRamp(): THREE.DataTexture {
  return useMemo(() => {
    const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }, []);
}

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function Coin({ tex, ramp }: { tex?: THREE.Texture; ramp: THREE.DataTexture }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1, 1, 0.17, 64]} />
      <meshToonMaterial attach="material-0" color="#0b6b52" gradientMap={ramp} />
      <meshToonMaterial attach="material-1" color="#ffffff" map={tex} gradientMap={ramp} />
      <meshToonMaterial attach="material-2" color="#ffffff" map={tex} gradientMap={ramp} />
      <Outlines thickness={0.06} color={INK} />
    </mesh>
  );
}

const PATHS = [
  { key: 'refund', label: 'Refund', sub: 'maintainer, to you', target: [-2.7, -1.5] as const },
  { key: 'forfeit', label: 'Forfeit to charity', sub: 'maintainer, to charity', target: [0, -2.35] as const },
  { key: 'reclaim', label: 'Reclaim', sub: 'anyone, after timeout', target: [2.7, -1.5] as const },
];

function Scene({ progress, tex }: { progress: MutableRefObject<number>; tex?: THREE.Texture }) {
  const ramp = useToonRamp();
  const main = useRef<THREE.Group>(null);
  const kids = useRef<(THREE.Group | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const lines = useRef<(THREE.Line | null)[]>([]);
  const seal = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = progress.current;
    const drop = ease(p / 0.3); // 0..0.3: the coin drops into the seal
    const split = ease((p - 0.38) / 0.42); // 0.38..0.8: it splits into three paths
    if (main.current) {
      main.current.visible = split < 0.02;
      main.current.position.set(0, 4.6 - drop * 4.6 - Math.sin(Math.min(1, drop) * Math.PI) * 0, 0.2);
      main.current.rotation.y = t * 0.7 + drop * 5;
    }
    if (seal.current) {
      const bump = p > 0.28 && p < 0.38 ? Math.sin(((p - 0.28) / 0.1) * Math.PI) * 0.05 : 0;
      seal.current.scale.setScalar(1 + bump);
      seal.current.position.y = Math.sin(t * 0.8) * 0.05;
    }
    PATHS.forEach((pa, i) => {
      const k = kids.current[i];
      if (k) {
        k.visible = split >= 0.02;
        const x = pa.target[0] * split;
        const y = pa.target[1] * split;
        k.position.set(x, y, 0.2);
        k.scale.setScalar(1 - split * 0.45);
        k.rotation.y = t * 0.9 + i;
      }
      const l = labels.current[i];
      if (l) l.style.opacity = String(clamp01((split - 0.5) * 2));
      const ln = lines.current[i];
      if (ln) (ln.material as THREE.LineBasicMaterial).opacity = clamp01(split * 1.3) * 0.7;
    });
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 6]} intensity={1.0} />
      <Sparkles count={34} scale={[8, 7, 2]} size={2.4} speed={0.25} color={GREEN} />

      {/* the Bond seal: shackle + ring + faint disc */}
      <group ref={seal}>
        <mesh position={[0, 0, -0.15]}>
          <circleGeometry args={[1.7, 64]} />
          <meshBasicMaterial color={GREEN} transparent opacity={0.1} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.7, 0.07, 16, 96]} />
          <meshToonMaterial color="#1b1b1b" gradientMap={ramp} />
          <Outlines thickness={0.045} color={GREEN} />
        </mesh>
        <mesh position={[0, 1.72, 0]}>
          <torusGeometry args={[0.62, 0.07, 16, 48, Math.PI]} />
          <meshToonMaterial color="#1b1b1b" gradientMap={ramp} />
          <Outlines thickness={0.045} color={GREEN} />
        </mesh>
      </group>

      <group ref={main} scale={0.95}>
        <Coin tex={tex} ramp={ramp} />
      </group>

      {PATHS.map((pa, i) => (
        <group key={pa.key}>
          <Line
            ref={(el) => {
              lines.current[i] = el as unknown as THREE.Line | null;
            }}
            points={[
              [0, 0, 0],
              [pa.target[0] * 0.35, pa.target[1] * 0.9, 0],
              [pa.target[0], pa.target[1], 0],
            ]}
            color={INK}
            lineWidth={1.4}
            dashed
            dashSize={0.16}
            gapSize={0.12}
            transparent
            opacity={0}
          />
          <group
            ref={(el) => {
              kids.current[i] = el;
            }}
            visible={false}
          >
            <Coin tex={tex} ramp={ramp} />
            <Html position={[0, -1.55, 0]} center distanceFactor={7.6} zIndexRange={[5, 0]}>
              <div
                className="scene-label"
                ref={(el) => {
                  labels.current[i] = el;
                }}
                style={{ opacity: 0 }}
              >
                <b>{pa.label}</b>
                <span>{pa.sub}</span>
              </div>
            </Html>
          </group>
        </group>
      ))}
    </>
  );
}

export default function Scene3D({ progress, active }: { progress: MutableRefObject<number>; active: boolean }) {
  const tex = useCoinTexture();
  return (
    <Canvas
      dpr={[1, 1.6]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 12], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
    >
      <Suspense fallback={null}>
        <Scene progress={progress} tex={tex} />
      </Suspense>
    </Canvas>
  );
}
