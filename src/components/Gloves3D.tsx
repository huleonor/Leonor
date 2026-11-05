/**
 * The gloves of the phase videos in 3D (the user's choice 2026-11: like the ghost hands of a VR
 * piano, as white gloves, with a real hand's build): over the flat video (`Lanes` in Reels.tsx,
 * which keeps everything else), a rigged human hand for each hand (the WebXR generic hand, MIT,
 * `public/models/hand`) in a white glove material, seen from above as he sees his own hands at the
 * piano. Playing, each fingertip goes onto the key it plays next (from the notes' fingering), the
 * finger curling to press while its note sounds; while the voice names the keys, the hand points
 * at the key being named with the index finger, the others curled. The camera maps the keys' plane
 * one to one onto the flat video's pixels, so the fingertips land exactly on its keys; everything
 * eases on a spring. Where WebGL is missing, Reels.tsx draws flat gloves instead.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ReelTimeline } from '../lib/reels';
import { isBlack } from '../lib/names';
import type { Hand } from '../lib/types';
import type { KeysGeom } from './Reels';


const models: Partial<Record<Hand, Promise<THREE.Object3D>>> = {};
const loadHand = (h: Hand) => (models[h] ??= new GLTFLoader().loadAsync(`/models/hand/${h === 'L' ? 'left' : 'right'}.glb`).then(g => g.scene));

const FINGER = ['', 'thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
const CHAIN: Record<number, string[]> = {
  1: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal'],
  2: ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal'],
  3: ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal'],
  4: ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal'],
  5: ['pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal'],
};

interface Props {
  tl: ReelTimeline; now: () => number;
  geom: React.RefObject<KeysGeom | null>;
  named: React.RefObject<Map<number, number>>; namedUntil: number;
}

type Rig = {
  h: Hand; root: THREE.Group; bones: Map<string, THREE.Object3D>; rest: Map<THREE.Object3D, THREE.Quaternion>;
  span: number; len: number; marks: THREE.Mesh[]; labels: THREE.Sprite[];
  fx: number[]; fy: number[]; point: number; px: number; py: number; seen: boolean;
};

export function Gloves3D({ tl, now, geom, named, namedUntil }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = box.current!;
    const css = getComputedStyle(host);
    const v = (k: string) => css.getPropertyValue(k).trim() || '#ffffff';
    const C = { R: v('--right'), L: v('--left'), white: v('--white'), ink: v('--ink') };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 1, 10000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f7a, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.5, 0.8, 1);
    scene.add(sun);
    const glove = new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.62, metalness: 0 });
    const tipMat = { R: new THREE.MeshBasicMaterial({ color: C.R }), L: new THREE.MeshBasicMaterial({ color: C.L }) };

    const numberTex = new Map<number, THREE.CanvasTexture>();
    const num = (f: number) => {
      let t = numberTex.get(f);
      if (!t) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d')!;
        g.fillStyle = C.ink; g.font = `700 40px 'Courier New', Courier, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(f), 32, 34);
        t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; numberTex.set(f, t);
      }
      return t;
    };

    const rigs: Partial<Record<Hand, Rig>> = {};
    let alive = true;
    for (const h of ['L', 'R'] as Hand[]) {
      if (!tl.notes.some(n => n.hand === h && n.finger)) continue;
      loadHand(h).then(src => {
        if (!alive) return;
        const model = cloneSkinned(src);
        model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isMesh) { m.material = glove; m.frustumCulled = false; } });
        const orient = new THREE.Group(); orient.add(model);
        const root = new THREE.Group(); root.add(orient);
        scene.add(root);
        const bones = new Map<string, THREE.Object3D>();
        // The bones the mesh is skinned to (names from the WebXR hand joints).
        model.traverse(o => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.bones.forEach(b => bones.set(b.name, b)); });
        model.traverse(o => { if (o.name && !bones.has(o.name)) bones.set(o.name, o); });
        // Turn the model so its fingers point up the screen, the back of the hand to the camera,
        // the thumb towards the middle (left of the right hand, right of the left).
        root.updateMatrixWorld(true);
        const P = (n: string) => bones.get(n)!.getWorldPosition(new THREE.Vector3());
        const wrist = P('wrist'), tip = P('middle-finger-tip'), ind = P('index-finger-phalanx-proximal'), pin = P('pinky-finger-phalanx-proximal');
        const y = tip.clone().sub(wrist).normalize();
        const across = ind.clone().sub(pin);
        const span = across.length();
        across.normalize();
        let z = new THREE.Vector3().crossVectors(across, y).normalize();
        let x = new THREE.Vector3().crossVectors(y, z).normalize();
        if (Math.sign(across.dot(x)) !== (h === 'R' ? -1 : 1)) { z = z.negate(); x = new THREE.Vector3().crossVectors(y, z).normalize(); }
        const basis = new THREE.Matrix4().makeBasis(x, y, z);
        orient.quaternion.setFromRotationMatrix(basis).invert();
        const rest = new Map<THREE.Object3D, THREE.Quaternion>();
        bones.forEach(b => rest.set(b, b.quaternion.clone()));
        const marks: THREE.Mesh[] = [], labels: THREE.Sprite[] = [];
        for (let f = 1; f <= 5; f++) {
          const tipBone = bones.get(`${FINGER[f]}-tip`)!;
          const mark = new THREE.Mesh(new THREE.SphereGeometry(span * 0.09, 16, 12), tipMat[h]);
          mark.visible = false; tipBone.add(mark); marks.push(mark);
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: num(f), depthTest: false, transparent: true }));
          label.scale.setScalar(span * 0.28); tipBone.add(label); labels.push(label);
        }
        rigs[h] = { h, root, bones, rest, span, len: tip.distanceTo(wrist), marks, labels, fx: [], fy: [], point: 0, px: 0, py: 0, seen: false };
      }).catch(err => console.warn('[gloves] the hand model could not load:', err));
    }

    const handOf = new Map<number, Hand>();
    for (const n of tl.notes) if (!handOf.has(n.midi)) handOf.set(n.midi, n.hand);
    const wv = new THREE.Vector3(), q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    const worldAxis = (axis: THREE.Vector3, bone: THREE.Object3D) => { bone.parent!.getWorldQuaternion(pq); return axis.clone().applyQuaternion(pq.invert()).normalize(); };
    const turn = (bone: THREE.Object3D, axisWorld: THREE.Vector3, angle: number) => { q.setFromAxisAngle(worldAxis(axisWorld, bone), angle); bone.quaternion.premultiply(q); };
    const X_AX = new THREE.Vector3(1, 0, 0), Z_AX = new THREE.Vector3(0, 0, 1);
    let raf = 0, last = performance.now();

    const draw = () => {
      const G = geom.current;
      const W = host.clientWidth, H = host.clientHeight;
      if (G && W > 0 && H > 0) {
        const nowMs = performance.now(), dt = Math.min(0.1, (nowMs - last) / 1000);
        last = nowMs;
        const k = 1 - Math.exp(-dt * 10);
        if (renderer.domElement.width !== Math.round(W * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(H * renderer.getPixelRatio())) renderer.setSize(W, H);
        // The keys' plane (z = 0) maps one to one onto the flat video's pixels.
        camera.aspect = W / H;
        const D = (H / 2) / Math.tan((camera.fov * Math.PI) / 360);
        camera.position.set(W / 2, -H / 2, D); camera.lookAt(W / 2, -H / 2, 0); camera.updateProjectionMatrix();
        const t = now();
        const namedKey = t < namedUntil && named.current && named.current.size ? [...named.current.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
        for (const h of ['L', 'R'] as Hand[]) {
          const rig = rigs[h];
          if (!rig) continue;
          const mine = tl.notes.filter(n => n.hand === h && n.finger);
          const dir = h === 'R' ? 1 : -1;
          // Where each fingertip should be: on the key it plays next, at the front of a white key,
          // further in on a black one.
          const wantX: (number | undefined)[] = [], wantY: number[] = [], press: boolean[] = [], real: boolean[] = [], soon: number[] = [];
          for (let f = 1; f <= 5; f++) {
            const ns = mine.filter(n => n.finger === f);
            const nx = ns.find(n => n.t + n.dur > t) ?? ns[ns.length - 1];
            const key = nx && G.X(nx.midi);
            if (key) { wantX[f] = key.x + key.w / 2; wantY[f] = G.kbTop + G.kbH * (isBlack(nx.midi) ? 0.34 : 0.6); real[f] = true; soon[f] = Math.max(0, nx.t - t); }
            press[f] = ns.some(n => n.t <= t && n.t + n.dur > t);
          }
          for (let f = 1; f <= 5; f++) if (wantX[f] === undefined) {
            let best: number | undefined, bd = 9;
            for (let g = 1; g <= 5; g++) if (wantX[g] !== undefined && Math.abs(g - f) < bd) { bd = Math.abs(g - f); best = wantX[g]! + (f - g) * dir * G.unitW; }
            wantX[f] = best; wantY[f] = G.kbTop + G.kbH * 0.6;
          }
          if (wantX.slice(1).some(x => x === undefined)) { rig.root.visible = false; continue; }
          rig.root.visible = true;
          const pk = namedKey !== undefined && (handOf.get(namedKey) ?? (namedKey < 60 ? 'L' : 'R')) === h ? G.X(namedKey) : null;
          if (!rig.seen) { for (let f = 1; f <= 5; f++) { rig.fx[f] = wantX[f]!; rig.fy[f] = wantY[f]; } rig.px = wantX[2]!; rig.py = wantY[2]; rig.seen = true; }
          for (let f = 1; f <= 5; f++) { rig.fx[f] += (wantX[f]! - rig.fx[f]) * k; rig.fy[f] += (wantY[f] - rig.fy[f]) * k; }
          rig.point += ((pk ? 1 : 0) - rig.point) * k;
          if (pk) { rig.px += (pk.x + pk.w / 2 - rig.px) * k; rig.py += (G.kbTop + G.kbH * 0.45 - rig.py) * k; }
          const p = rig.point;
          // Scale: the knuckles of index to little finger span about three white keys, like a hand.
          // never so big that the wrist leaves the screen (a zoomed-in keyboard on a phone).
          const s = Math.min((G.unitW * 3.1) / rig.span, ((H - G.kbTop) * 0.98) / rig.len);
          rig.root.scale.setScalar(s);
          // The pose: back to rest, then each finger curled (more to press; the others into a fist
          // when pointing) and turned towards its key.
          rig.rest.forEach((qq, b) => b.quaternion.copy(qq));
          for (let f = 1; f <= 5; f++) {
            const pressing = press[f] && p < 0.5;
            let curl = f === 1 ? 0.2 : 0.55 + (pressing ? 0.3 : 0);
            if (f === 2) curl += (0.02 - curl) * p; else curl += ((f === 1 ? 0.7 : 1.35) - curl) * p;
            CHAIN[f].forEach((n, i) => turn(rig.bones.get(n)!, X_AX, -curl * (i === 0 ? 0.8 : 0.6)));
            rig.marks[f - 1].visible = pressing;
            rig.labels[f - 1].visible = p < 0.5;
          }
          // Place the hand so its fingers land on their keys on average (the index finger alone
          // when pointing), then turn each finger towards its own key, gently (a real hand cannot
          // splay far); twice, to settle.
          const used = p > 0.5 ? [2] : [1, 2, 3, 4, 5].filter(f => real[f]);
          const tx = (f: number) => (p > 0.5 ? rig.px : rig.fx[f]), ty = (f: number) => (p > 0.5 ? rig.py : rig.fy[f]);
          for (let pass = 0; pass < 3; pass++) {
            rig.root.updateMatrixWorld(true);
            let dx = 0, dy = 0, dz = 0;
            // The notes about to sound pull hardest, so the hand travels with a jump.
            let n = 0;
            for (const f of used) { const w = 1 / (0.15 + (soon[f] ?? 1)); rig.bones.get(`${FINGER[f]}-tip`)!.getWorldPosition(wv); dx += (tx(f) - wv.x) * w; dy += (-ty(f) - wv.y) * w; dz += -wv.z * w; n += w; }
            n = Math.max(1e-6, n);
            rig.root.position.x += dx / n; rig.root.position.y += dy / n; rig.root.position.z += dz / n;
            if (pass === 2) break;
            if (pass === 1) continue;
            rig.root.updateMatrixWorld(true);
            for (let f = 1; f <= 5; f++) {
              if (p > 0.5 && f !== 2) continue;
              const base = rig.bones.get(CHAIN[f][0])!, tipB = rig.bones.get(`${FINGER[f]}-tip`)!;
              const b0 = base.getWorldPosition(new THREE.Vector3()), t0 = tipB.getWorldPosition(new THREE.Vector3());
              const now0 = Math.atan2(t0.x - b0.x, t0.y - b0.y);
              const want = Math.atan2(tx(f) - b0.x, -ty(f) - b0.y);
              turn(base, Z_AX, -Math.max(-0.3, Math.min(0.3, want - now0)));
            }
          }
        }
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      renderer.dispose();
      numberTex.forEach(t => t.dispose());
      host.removeChild(renderer.domElement);
    };
  }, [tl, now, geom, named, namedUntil]);
  return <div ref={box} className="reel-gloves" aria-hidden="true" />;
}
