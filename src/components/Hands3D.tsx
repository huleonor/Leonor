/**
 * The hands of the phase videos: real human hands in 3D (the user's choice 2026-11, after the
 * cartoon gloves looked strange), the hands of the voice that teaches. Only the hands are 3D; the
 * video stays flat (`Lanes` in Reels.tsx).
 *
 * The model: "Rigged hand" by Elena FF (Sketchfab, CC BY-SA 4.0, `public/models/hand` with its
 * licence; credited in Settings): a skinned human hand with palm volume, knuckle creases and
 * fingernails in its skin texture, a deforming bone for every metacarpal and phalanx. The right
 * hand is mirrored for the left. Seen from above as he sees his own hands at the piano, on its own
 * see-through canvas over the flat keys; the keys' plane maps one to one onto their pixels
 * (`KeysGeom`), so a fingertip placed on a key lands on it.
 *
 * The motion is solved, not keyframed (after the animation rules of the Blender skills: eased
 * curves, overlap, moving holds, stable contacts):
 * - each finger: abduction at the knuckle within its range from a natural spread, flexion at its
 *   three joints with the end joint coupled to the middle one (0.72), joint limits, a damped
 *   Gauss-Newton IK warm-started each frame, so it keeps a soft curve and never goes straight; each
 *   bone is then turned from its rest pose to aim at the next joint (its roll kept);
 * - the thumb bends in its own plane, turned in towards the palm (opposition);
 * - the press follows the note: a lift just before, a quick strike on time, the tip held on the key
 *   while it sounds, an eased release; idle fingers hover at their own heights and dip a little with
 *   a pressing neighbour;
 * - the knuckles sit above the keys in front of them so the fingers arch like a pianist's; the hand
 *   travels on a damped spring led by the notes about to sound; the wrist turns into the movement,
 *   rolls towards the finger that presses and breathes a little when it holds; every finger has its
 *   own stiffness, so no two move alike;
 * - while the voice names a key, the hand points at it with the index finger, the others curled.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ReelTimeline } from '../lib/reels';
import { isBlack } from '../lib/names';
import type { Hand } from '../lib/types';
import type { KeysGeom } from './Reels';

let model: Promise<THREE.Object3D> | null = null;
const loadModel = () => (model ??= new GLTFLoader().loadAsync('/models/hand/hand.glb').then(g => g.scene));

const NAMES = ['', 'thumb', 'index', 'middle', 'ring', 'pinky'];
const SPREAD = [0, 0, -0.06, 0, 0.05, 0.12];
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const rnd = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

interface Props {
  tl: ReelTimeline; now: () => number;
  geom: React.RefObject<KeysGeom | null>;
  named: React.RefObject<Map<number, number>>; namedUntil: number;
}

type Finger = {
  f: number; bones: THREE.Bone[]; ends: THREE.Object3D[]; rest: THREE.Quaternion[]; axis: THREE.Vector3[]; len: number[];
  theta: [number, number]; abd: number; x: number; y: number; vx: number; vy: number; hover: number; stiff: number;
};
type Rig = {
  h: Hand; root: THREE.Group; fingers: Finger[]; all: THREE.Bone[]; restAll: THREE.Quaternion[];
  align: THREE.Quaternion; fwd: THREE.Vector3; back: THREE.Vector3; span: number; length: number;
  wx: number; vwx: number; yaw: number; roll: number; point: number; px: number; py: number; seen: boolean;
};

export function Hands3D({ tl, now, geom, named, namedUntil }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = box.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 1, 20000);
    // Soft light from above the music stand, warm like the paper, a cool fill, a rim for the edges.
    scene.add(new THREE.HemisphereLight(0xfff3e2, 0x8f7f6a, 1.25));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.3); key.position.set(-0.45, 0.65, 1); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); fill.position.set(0.8, -0.3, 0.6); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, 1, -0.4); scene.add(rim);

    const rigs: Partial<Record<Hand, Rig>> = {};
    let alive = true;
    const handOf = new Map<number, Hand>();
    for (const n of tl.notes) if (!handOf.has(n.midi)) handOf.set(n.midi, n.hand);

    for (const h of ['L', 'R'] as Hand[]) {
      if (!tl.notes.some(n => n.hand === h && n.finger)) continue;
      loadModel().then(src => {
        if (!alive) return;
        const m = cloneSkinned(src);
        const inner = new THREE.Group(); inner.add(m);
        // The model is a right hand; the left one is its mirror image.
        if (h === 'L') inner.scale.x = -1;
        const root = new THREE.Group(); root.add(inner);
        scene.add(root);
        let skinned: THREE.SkinnedMesh | null = null;
        m.traverse(o => {
          const s = o as THREE.SkinnedMesh;
          if (s.isSkinnedMesh) {
            skinned = s; s.frustumCulled = false;
            const mat = (s.material as THREE.MeshPhysicalMaterial).clone();
            mat.side = THREE.DoubleSide; mat.roughness = 0.6; mat.sheen = 0.3; mat.sheenRoughness = 0.6; mat.sheenColor = new THREE.Color(0xffe2cc);
            s.material = mat;
          }
        });
        if (!skinned) return;
        const sk = (skinned as THREE.SkinnedMesh).skeleton;
        const bones = new Map<string, THREE.Bone>();
        sk.bones.forEach(b => bones.set(b.name.replace(/R_?\d+$/, '').replace(/R$/, ''), b));
        root.updateMatrixWorld(true);
        const W = (b: THREE.Object3D) => b.getWorldPosition(v());
        // The hand's own axes, measured on the model: forward from the wrist to the middle knuckle,
        // across from the little finger's knuckle to the index's, and the back of the hand away
        // from the side the fingers curl to.
        const wrist = W(bones.get('pulse')!), mid1 = W(bones.get('middle_01')!);
        const fwd = mid1.clone().sub(wrist).normalize();
        const across = W(bones.get('index_01')!).sub(W(bones.get('pinky_01')!)).normalize();
        const back = v().crossVectors(fwd, across).normalize();
        if (back.dot(W(bones.get('middle_02')!).sub(mid1)) > 0) back.negate();
        const side = v().crossVectors(fwd, back).normalize();
        // Align: forward up the screen, the back of the hand to the camera. The thumb then falls to
        // the middle of the keyboard by itself (left of the right hand, right of the mirrored left).
        const basis = new THREE.Matrix4().makeBasis(side, fwd, back);
        const align = new THREE.Quaternion().setFromRotationMatrix(basis).invert();
        const fingers: Finger[] = [];
        for (let f = 1; f <= 5; f++) {
          const name = NAMES[f];
          const chain = [bones.get(`${name}_01`)!, bones.get(`${name}_02`)!, bones.get(`${name}_03`)!];
          const ends = [chain[1], chain[2], chain[2].children.find(c => /end/.test(c.name)) ?? chain[2].children[0]];
          const len = chain.map((b, i) => W(ends[i]).distanceTo(W(b)));
          fingers.push({
            f, bones: chain, ends, rest: chain.map(b => b.quaternion.clone()), axis: chain.map((_, i) => ends[i].position.clone().normalize()), len,
            theta: [0.3, 0.7], abd: 0, x: 0, y: 0, vx: 0, vy: 0,
            hover: rnd(f + (h === 'L' ? 10 : 0)), stiff: 15 + rnd(f * 3 + (h === 'L' ? 5 : 0)) * 7,
          });
        }
        const span = W(bones.get('index_01')!).distanceTo(W(bones.get('pinky_01')!));
        const length = W(bones.get('middle_01')!).distanceTo(wrist) + fingers[2].len.reduce((a, b) => a + b, 0);
        rigs[h] = { h, root, fingers, all: sk.bones, restAll: sk.bones.map(b => b.quaternion.clone()), align, fwd, back, span, length, wx: 0, vwx: 0, yaw: 0, roll: 0, point: 0, px: 0, py: 0, seen: false };
      }).catch(err => console.warn('[hands] the hand model could not load:', err));
    }

    const q = new THREE.Quaternion(), pq = new THREE.Quaternion();
    /** Turn a bone so it points at a world position, from its rest rotation (keeps its roll). */
    const aim = (b: THREE.Bone, rest: THREE.Quaternion, axis: THREE.Vector3, target: THREE.Vector3) => {
      b.quaternion.copy(rest);
      b.updateWorldMatrix(true, false);
      const pos = b.getWorldPosition(v());
      b.parent!.getWorldQuaternion(pq);
      const want = target.clone().sub(pos).normalize().applyQuaternion(pq.invert());
      q.setFromUnitVectors(axis.clone().applyQuaternion(rest).normalize(), want);
      b.quaternion.premultiply(q);
      b.updateWorldMatrix(false, true);
    };
    const planar = (len: number[], a: number, b: number): [number, number] => {
      const c = b * 0.72;
      return [len[0] * Math.cos(a) + len[1] * Math.cos(a + b) + len[2] * Math.cos(a + b + c), len[0] * Math.sin(a) + len[1] * Math.sin(a + b) + len[2] * Math.sin(a + b + c)];
    };
    const solve = (fg: Finger, len: number[], u: number, d: number, lim: [number, number, number, number]) => {
      let [a, b] = fg.theta;
      const L = len[0] + len[1] + len[2], lam = (0.08 * L) ** 2;
      for (let it = 0; it < 12; it++) {
        const [x, y] = planar(len, a, b);
        const ex = u - x, ey = d - y;
        if (ex * ex + ey * ey < (0.004 * L) ** 2) break;
        const e = 1e-3;
        const [xa, ya] = planar(len, a + e, b), [xb, yb] = planar(len, a, b + e);
        const j11 = (xa - x) / e, j21 = (ya - y) / e, j12 = (xb - x) / e, j22 = (yb - y) / e;
        const A11 = j11 * j11 + j21 * j21 + lam, A12 = j11 * j12 + j21 * j22, A22 = j12 * j12 + j22 * j22 + lam;
        const g1 = j11 * ex + j21 * ey, g2 = j12 * ex + j22 * ey, det = A11 * A22 - A12 * A12;
        if (Math.abs(det) < 1e-12) break;
        a = clamp(a + (A22 * g1 - A12 * g2) / det, lim[0], lim[1]);
        b = clamp(b + (-A12 * g1 + A11 * g2) / det, lim[2], lim[3]);
      }
      fg.theta = [a, b];
    };

    let raf = 0, last = performance.now();
    const draw = () => {
      const G = geom.current;
      const Wd = host.clientWidth, Ht = host.clientHeight;
      if (G && Wd > 0 && Ht > 0) {
        const nowMs = performance.now(), dt = Math.min(0.05, (nowMs - last) / 1000);
        last = nowMs;
        const pr = renderer.getPixelRatio();
        if (renderer.domElement.width !== Math.round(Wd * pr) || renderer.domElement.height !== Math.round(Ht * pr)) renderer.setSize(Wd, Ht);
        camera.aspect = Wd / Ht;
        const D = (Ht / 2) / Math.tan((camera.fov * Math.PI) / 360);
        camera.position.set(Wd / 2, -Ht / 2, D); camera.lookAt(Wd / 2, -Ht / 2, 0); camera.updateProjectionMatrix();
        const t = now();
        const namedKey = t < namedUntil && named.current && named.current.size ? [...named.current.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
        const kw = G.unitW;
        for (const h of ['L', 'R'] as Hand[]) {
          const rig = rigs[h];
          if (!rig) continue;
          const dir = h === 'R' ? 1 : -1;
          const mine = tl.notes.filter(n => n.hand === h && n.finger);
          // Size: knuckles of index to little finger over about three white keys, as a real hand;
          // the forearm may leave the screen at the bottom, the hand itself never.
          const s = Math.min((kw * 3.0) / rig.span, (Ht - G.kbTop) * 1.5 / rig.length);
          rig.root.scale.setScalar(s);
          const fl = rig.fingers[2].len.reduce((a, b) => a + b, 0) * s;
          // Each finger's next note: where on the key, and its press envelope from the note times.
          const want: { x?: number; y: number; z: number; real: boolean; soon: number; press: number }[] = [];
          for (let f = 1; f <= 5; f++) {
            const ns = mine.filter(n => n.finger === f);
            const nx = ns.find(n => n.t + n.dur > t - 0.12) ?? ns[ns.length - 1];
            const k = nx && G.X(nx.midi);
            const hover = fl * (0.07 + 0.05 * rig.fingers[f - 1].hover);
            if (nx && k) {
              let z = hover, press = 0;
              const t0 = nx.t, t1 = nx.t + Math.max(0.12, nx.dur * 0.92), lift = fl * 0.2;
              if (t < t0 - 0.24) z = hover;
              else if (t < t0 - 0.07) z = hover + (lift - hover) * smooth((t - (t0 - 0.24)) / 0.17);
              else if (t < t0) { const e = (t - (t0 - 0.07)) / 0.07; z = lift * (1 - e * e * e); press = e; }
              else if (t < t1) { z = -fl * 0.02; press = 1; }
              else if (t < t1 + 0.14) { const e = smooth((t - t1) / 0.14); z = -fl * 0.02 + (hover + fl * 0.02) * e; press = 1 - e; }
              const black = isBlack(nx.midi);
              want[f] = { x: k.x + k.w / 2, y: G.kbTop + G.kbH * (black ? 0.3 : f === 1 ? 0.7 : 0.6), z: z + (black ? fl * 0.08 : 0), real: true, soon: Math.max(0, t0 - t), press };
            } else want[f] = { y: G.kbTop + G.kbH * 0.6, z: hover * 1.8, real: false, soon: 9, press: 0 };
          }
          for (let f = 1; f <= 5; f++) if (want[f].x === undefined) {
            let best: number | undefined, bd = 9;
            for (let g = 1; g <= 5; g++) if (want[g].real && Math.abs(g - f) < bd) { bd = Math.abs(g - f); best = want[g].x! + (f - g) * dir * kw * 1.05; }
            want[f].x = best;
          }
          if (want.slice(1).some(w => w.x === undefined)) { rig.root.visible = false; continue; }
          rig.root.visible = true;
          // Tendons: a pressing finger pulls its neighbours down a little.
          for (let f = 2; f <= 5; f++) for (const g of [f - 1, f + 1]) if (g >= 2 && g <= 5 && want[g].press > 0.5 && want[f].press < 0.2) want[f].z -= fl * 0.03 * want[g].press;
          const pk = namedKey !== undefined && (handOf.get(namedKey) ?? (namedKey < 60 ? 'L' : 'R')) === h ? G.X(namedKey) : null;
          if (!rig.seen) {
            for (const fg of rig.fingers) { fg.x = want[fg.f].x!; fg.y = want[fg.f].y; }
            rig.wx = want[3].x!; rig.px = want[2].x!; rig.py = want[2].y; rig.seen = true;
          }
          // Damped springs, stepped finely so they stay stable on a slow frame.
          const steps = Math.max(1, Math.ceil(dt / 0.006)), h2 = dt / steps;
          for (const fg of rig.fingers) {
            const w = want[fg.f], om = fg.stiff, ze = 0.82;
            for (let k = 0; k < steps; k++) {
              fg.vx += (om * om * (w.x! - fg.x) - 2 * ze * om * fg.vx) * h2; fg.x += fg.vx * h2;
              fg.vy += (om * om * (w.y - fg.y) - 2 * ze * om * fg.vy) * h2; fg.y += fg.vy * h2;
            }
          }
          rig.point += ((pk ? 1 : 0) - rig.point) * (1 - Math.exp(-dt * 8));
          if (pk) { rig.px += (pk.x + pk.w / 2 - rig.px) * (1 - Math.exp(-dt * 10)); rig.py += (G.kbTop + G.kbH * 0.45 - rig.py) * (1 - Math.exp(-dt * 10)); }
          const p = rig.point;
          // The wrist, led by the notes about to sound, on its own slower spring.
          let sx = 0, sw = 0;
          for (let f = 1; f <= 5; f++) { const w = want[f].real ? 1 / (0.2 + want[f].soon) : 0.15; sx += (rig.fingers[f - 1].x - (f - 3) * dir * kw * 0.95) * w; sw += w; }
          const handX = p > 0.5 ? rig.px + dir * kw * 0.9 : sx / sw;
          const om = 9, ze = 0.9;
          for (let k = 0; k < steps; k++) { rig.vwx += (om * om * (handX - rig.wx) - 2 * ze * om * rig.vwx) * h2; rig.wx += rig.vwx * h2; }
          const pressSide = [1, 2, 3, 4, 5].reduce((a, f) => a + want[f].press * (f - 3), 0);
          rig.yaw += (clamp(-rig.vwx / (kw * 45), -0.12, 0.12) - rig.yaw) * (1 - Math.exp(-dt * 6));
          rig.roll += (clamp(pressSide * 0.035 * dir, -0.12, 0.12) - rig.roll) * (1 - Math.exp(-dt * 7));
          const breathe = Math.sin(t * 1.7 + (h === 'L' ? 1.3 : 0)) * 0.012 + Math.sin(t * 0.63 + (h === 'L' ? 2 : 0)) * 0.008;
          rig.root.quaternion.setFromEuler(new THREE.Euler(-(0.12 + breathe), rig.roll, rig.yaw, 'ZXY')).multiply(rig.align);
          // Reset the pose, then place the hand: the middle knuckle in front of the keys (lower on
          // the screen) by most of a finger and about half a finger above them.
          rig.all.forEach((b, i) => b.quaternion.copy(rig.restAll[i]));
          rig.root.position.set(0, 0, 0);
          rig.root.updateMatrixWorld(true);
          const k3 = rig.fingers[2].bones[0].getWorldPosition(v());
          const keyY = p > 0.5 ? rig.py : rig.fingers[2].y;
          rig.root.position.set(rig.wx - k3.x, -(keyY + fl * 0.6) - k3.y, fl * 0.56 - k3.z);
          rig.root.updateMatrixWorld(true);

          // The hand's frame in the world, for the fingers' planes.
          const Fw = rig.fwd.clone().applyQuaternion(rig.root.quaternion).normalize();
          const Dn = rig.back.clone().applyQuaternion(rig.root.quaternion).normalize().negate();
          const Ac = v().crossVectors(Dn, Fw).normalize();
          for (const fg of rig.fingers) {
            const f = fg.f, thumb = f === 1;
            const M = fg.bones[0].getWorldPosition(v());
            const len = fg.len.map(l => l * s);
            // The thumb bends in towards the palm (opposition), the others straight down.
            const toPalm = Ac.clone().multiplyScalar(-dir);
            const down = thumb ? Dn.clone().multiplyScalar(0.8).addScaledVector(toPalm, 0.6).normalize() : Dn.clone();
            if (p > 0.5 && f !== 2) {
              fg.theta = [fg.theta[0] + ((thumb ? 0.5 : 1.15) - fg.theta[0]) * 0.25, fg.theta[1] + ((thumb ? 0.7 : 1.45) - fg.theta[1]) * 0.25];
            } else {
              const w = want[f];
              const pointing = p > 0.5 && f === 2;
              const T = v(pointing ? rig.px : fg.x, -(pointing ? rig.py : fg.y), pointing ? fl * 0.35 : w.z);
              const rel = T.clone().sub(M);
              const sp = SPREAD[f] * dir;
              const lat = rel.dot(Ac), fwdD = Math.max(1, rel.dot(Fw));
              fg.abd += (clamp(Math.atan2(lat, fwdD), sp - (thumb ? 0.7 : 0.3), sp + (thumb ? 0.7 : 0.3)) - fg.abd) * 0.5;
              const plane = Fw.clone().applyAxisAngle(Dn, -fg.abd);
              solve(fg, len, rel.dot(plane), rel.dot(down), thumb ? [-0.2, 0.9, 0.05, 1.0] : [-0.25, 1.35, 0.18, 1.75]);
            }
            const plane = Fw.clone().applyAxisAngle(Dn, -fg.abd);
            const [a, b] = fg.theta, c = b * 0.72;
            const seg = (ang: number, l: number) => plane.clone().multiplyScalar(Math.cos(ang) * l).addScaledVector(down, Math.sin(ang) * l);
            const P2 = M.clone().add(seg(a, len[0])), P3 = P2.clone().add(seg(a + b, len[1])), P4 = P3.clone().add(seg(a + b + c, len[2]));
            aim(fg.bones[0], fg.rest[0], fg.axis[0], P2);
            aim(fg.bones[1], fg.rest[1], fg.axis[1], P3);
            aim(fg.bones[2], fg.rest[2], fg.axis[2], P4);
          }
        }
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); renderer.dispose(); host.removeChild(renderer.domElement); };
  }, [tl, now, geom, named, namedUntil]);
  return <div ref={box} className="reel-gloves" aria-hidden="true" />;
}
