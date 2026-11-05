/**
 * The hands of the phase videos: soft white cartoon gloves in 3D (the user's choice 2026-11: "the
 * same glove shape, not real hands"), the hands of the voice that teaches. Only the gloves are 3D;
 * the video stays flat (`Lanes` in Reels.tsx). Our own glove, built here from rounded shapes (no
 * model file, no brand's character): a plump palm, five chubby fingers in three joints each, the
 * thumb set apart and turned in, a rolled cuff, a soft cloth material. Seen from above as he sees
 * his own hands at the piano, on a see-through canvas over the flat keys; the keys' plane maps one
 * to one onto their pixels (`KeysGeom`), so a fingertip placed on a key lands on it.
 *
 * The motion is solved, not keyframed (after the animation rules of the Blender skills: eased
 * splines, overlap, moving holds, stable contacts):
 * - each finger: abduction at the knuckle within its range from a natural spread, flexion at three
 *   joints with the end joint coupled to the middle one (0.72), joint limits, a damped Gauss-Newton
 *   IK warm-started from the last frame, so it keeps a soft curve and never goes straight;
 * - the thumb bends in its own plane, turned in towards the palm (opposition);
 * - the press follows the note: a lift just before, a quick strike into the key on time, the tip
 *   held on the key while it sounds, an eased release; idle fingers hover at their own heights and
 *   dip a little with a pressing neighbour;
 * - the knuckles sit about a third of a finger above the keys and the hand travels on a damped
 *   spring led by the notes about to sound; the wrist turns into the movement, rolls towards the
 *   finger that presses and breathes a little when it holds; every finger has its own stiffness;
 * - while the voice names a key, the hand points at it with the index finger, the others curled.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { ReelTimeline } from '../lib/reels';
import { isBlack } from '../lib/names';
import type { Hand } from '../lib/types';
import type { KeysGeom } from './Reels';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const rnd = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// The glove, in palm units (the knuckles of index to little finger span 0.6), for a right hand:
// fingers point along +y, the back of the hand faces +z, the thumb is on the -x side.
const KNUCKLE: Record<number, [number, number, number]> = { 1: [-0.42, 0.2, -0.04], 2: [-0.3, 0.5, 0.02], 3: [-0.1, 0.55, 0.03], 4: [0.1, 0.53, 0.02], 5: [0.29, 0.46, 0] };
const LENGTHS: Record<number, number[]> = { 1: [0.34, 0.28, 0.22], 2: [0.36, 0.27, 0.22], 3: [0.4, 0.29, 0.23], 4: [0.38, 0.27, 0.22], 5: [0.3, 0.22, 0.19] };
const RADIUS: Record<number, number> = { 1: 0.135, 2: 0.118, 3: 0.122, 4: 0.116, 5: 0.104 };
const SPREAD: Record<number, number> = { 1: 0, 2: -0.07, 3: 0, 4: 0.06, 5: 0.14 };

interface Props {
  tl: ReelTimeline; now: () => number;
  geom: React.RefObject<KeysGeom | null>;
  named: React.RefObject<Map<number, number>>; namedUntil: number;
}

type Finger = {
  f: number; segs: THREE.Mesh[]; knuckles: THREE.Mesh[]; label: THREE.Sprite; tipMat: THREE.MeshPhysicalMaterial;
  theta: [number, number]; abd: number; x: number; y: number; vx: number; vy: number; hover: number; stiff: number;
};
type Rig = { h: Hand; root: THREE.Group; fingers: Finger[]; wx: number; vwx: number; yaw: number; roll: number; point: number; px: number; py: number; seen: boolean };

export function Hands3D({ tl, now, geom, named, namedUntil }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = box.current!;
    const css = getComputedStyle(host);
    const tok = (k: string) => css.getPropertyValue(k).trim() || '#ffffff';
    const C = { R: tok('--right'), L: tok('--left'), ink: tok('--ink') };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 1, 20000);
    // Soft studio light: a big warm key from the top left, a cool fill, a rim for the edges.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3c4, 1.5));
    const keyL = new THREE.DirectionalLight(0xfff6ea, 2.0); keyL.position.set(-0.5, 0.7, 1); scene.add(keyL);
    const fill = new THREE.DirectionalLight(0xdbe6ff, 0.6); fill.position.set(0.9, -0.4, 0.5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(0.2, 1, -0.6); scene.add(rim);
    // A soft cloth: white, matte with a gentle sheen, like the glove in the user's picture.
    const cloth = () => new THREE.MeshPhysicalMaterial({ color: 0xf8f9fc, roughness: 0.55, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.15, clearcoatRoughness: 0.6 });
    const glove = cloth();

    const numTex = new Map<number, THREE.CanvasTexture>();
    const num = (f: number) => {
      let t = numTex.get(f);
      if (!t) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d')!;
        g.fillStyle = C.ink; g.font = `700 40px 'Courier New', Courier, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(f), 32, 34);
        t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; numTex.set(f, t);
      }
      return t;
    };

    const makeRig = (h: Hand): Rig => {
      const side = h === 'R' ? 1 : -1;
      const root = new THREE.Group();
      // The palm: a plump rounded body, thicker at the knuckles, with a softer heel.
      const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), glove);
      palm.scale.set(0.47, 0.42, 0.2); palm.position.set(0, 0.12, 0);
      const knuckleRidge = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.5, 8, 24), glove);
      knuckleRidge.rotation.z = Math.PI / 2 + 0.08; knuckleRidge.position.set(0, 0.44, 0.0); knuckleRidge.scale.set(1, 1, 0.85);
      const heel = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), glove);
      heel.scale.set(0.43, 0.36, 0.19); heel.position.set(0, -0.16, -0.01);
      const thumbPad = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), glove);
      thumbPad.scale.set(0.2, 0.26, 0.17); thumbPad.position.set(-0.3, -0.02, -0.03);
      // The cuff: a flared band with a rolled lip.
      const cuffMat = cloth(); cuffMat.side = THREE.DoubleSide;
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.39, 0.2, 40, 1, true), cuffMat);
      cuff.position.set(0, -0.5, -0.01);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.06, 18, 48), glove);
      lip.rotation.x = Math.PI / 2; lip.position.set(0, -0.6, -0.01);
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.2, 32), glove);
      wrist.position.set(0, -0.36, -0.01);
      root.add(palm, knuckleRidge, heel, thumbPad, cuff, lip, wrist);
      const fingers: Finger[] = [];
      for (let f = 1; f <= 5; f++) {
        const r = RADIUS[f];
        const tipMat = cloth();
        const segs = LENGTHS[f].map((l, i) => {
          const m = new THREE.Mesh(new THREE.CapsuleGeometry(r * (1 - i * 0.05), l, 10, 24), i === 2 ? tipMat : glove);
          root.add(m); return m;
        });
        const knuckles = [0, 1, 2].map(i => { const m = new THREE.Mesh(new THREE.SphereGeometry(r * (1.04 - i * 0.05), 24, 18), glove); root.add(m); return m; });
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: num(f), depthTest: false, transparent: true }));
        label.scale.setScalar(0.17); root.add(label);
        fingers.push({ f, segs, knuckles, label, tipMat, theta: [0.3, 0.7], abd: SPREAD[f], x: 0, y: 0, vx: 0, vy: 0, hover: rnd(f + (h === 'L' ? 9 : 0)), stiff: 15 + rnd(f * 3.1 + (h === 'L' ? 4 : 0)) * 7 });
      }
      // The left glove is the right one's mirror image.
      root.scale.x = side;
      scene.add(root);
      return { h, root, fingers, wx: 0, vwx: 0, yaw: 0, roll: 0, point: 0, px: 0, py: 0, seen: false };
    };
    const rigs: Partial<Record<Hand, Rig>> = {};
    for (const h of ['L', 'R'] as Hand[]) if (tl.notes.some(n => n.hand === h && n.finger)) rigs[h] = makeRig(h);
    const handOf = new Map<number, Hand>();
    for (const n of tl.notes) if (!handOf.has(n.midi)) handOf.set(n.midi, n.hand);

    /** A finger's tip in its own plane (forward, down) for angles a (knuckle), b (middle joint). */
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
    const UP = v(0, 1, 0);
    const place = (m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) => { m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); };

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
          const side = h === 'R' ? 1 : -1;
          const mine = tl.notes.filter(n => n.hand === h && n.finger);
          // Size: the knuckles of index to little finger over about three white keys; never so
          // big that the cuff leaves the screen.
          const s = Math.min((kw * 3.1) / 0.6, (Ht - G.kbTop) / 1.95);
          // Each finger's next note: where on the key, and its press envelope from the note times.
          const want: { x?: number; y: number; z: number; real: boolean; soon: number; press: number }[] = [];
          for (let f = 1; f <= 5; f++) {
            const ns = mine.filter(n => n.finger === f);
            const nx = ns.find(n => n.t + n.dur > t - 0.12) ?? ns[ns.length - 1];
            const k = nx && G.X(nx.midi);
            const hover = s * (0.07 + 0.04 * rig.fingers[f - 1].hover);
            if (nx && k) {
              let z = hover, press = 0;
              const t0 = nx.t, t1 = nx.t + Math.max(0.12, nx.dur * 0.92), lift = s * 0.17;
              if (t < t0 - 0.24) z = hover;
              else if (t < t0 - 0.07) z = hover + (lift - hover) * smooth((t - (t0 - 0.24)) / 0.17);
              else if (t < t0) { const e = (t - (t0 - 0.07)) / 0.07; z = lift * (1 - e * e * e); press = e; }
              else if (t < t1) { z = -s * 0.015; press = 1; }
              else if (t < t1 + 0.14) { const e = smooth((t - t1) / 0.14); z = -s * 0.015 + (hover + s * 0.015) * e; press = 1 - e; }
              const black = isBlack(nx.midi);
              want[f] = { x: k.x + k.w / 2, y: G.kbTop + G.kbH * (black ? 0.3 : f === 1 ? 0.7 : 0.6), z: z + (black ? s * 0.06 : 0), real: true, soon: Math.max(0, t0 - t), press };
            } else want[f] = { y: G.kbTop + G.kbH * 0.62, z: hover * 1.8, real: false, soon: 9, press: 0 };
          }
          for (let f = 1; f <= 5; f++) if (want[f].x === undefined) {
            let best: number | undefined, bd = 9;
            for (let g = 1; g <= 5; g++) if (want[g].real && Math.abs(g - f) < bd) { bd = Math.abs(g - f); best = want[g].x! + (f - g) * side * kw * 1.05; }
            want[f].x = best;
          }
          if (want.slice(1).some(w => w.x === undefined)) { rig.root.visible = false; continue; }
          rig.root.visible = true;
          // Tendons: a pressing finger pulls its neighbours down a little.
          for (let f = 2; f <= 5; f++) for (const g of [f - 1, f + 1]) if (g >= 2 && g <= 5 && want[g].press > 0.5 && want[f].press < 0.2) want[f].z -= s * 0.02 * want[g].press;
          const pk = namedKey !== undefined && (handOf.get(namedKey) ?? (namedKey < 60 ? 'L' : 'R')) === h ? G.X(namedKey) : null;
          if (!rig.seen) {
            for (const fg of rig.fingers) { fg.x = want[fg.f].x!; fg.y = want[fg.f].y; }
            rig.wx = want[3].x!; rig.px = want[2].x!; rig.py = want[2].y; rig.seen = true;
          }
          for (const fg of rig.fingers) {
            const w = want[fg.f], om = fg.stiff, ze = 0.82;
            fg.vx += (om * om * (w.x! - fg.x) - 2 * ze * om * fg.vx) * dt; fg.x += fg.vx * dt;
            fg.vy += (om * om * (w.y - fg.y) - 2 * ze * om * fg.vy) * dt; fg.y += fg.vy * dt;
          }
          rig.point += ((pk ? 1 : 0) - rig.point) * (1 - Math.exp(-dt * 8));
          if (pk) { rig.px += (pk.x + pk.w / 2 - rig.px) * (1 - Math.exp(-dt * 10)); rig.py += (G.kbTop + G.kbH * 0.45 - rig.py) * (1 - Math.exp(-dt * 10)); }
          const p = rig.point;
          // The wrist, led by the notes about to sound, on its own slower spring.
          let sx = 0, sw = 0;
          for (let f = 1; f <= 5; f++) { const w = want[f].real ? 1 / (0.2 + want[f].soon) : 0.15; sx += (rig.fingers[f - 1].x - (KNUCKLE[f][0] - KNUCKLE[3][0]) * side * s) * w; sw += w; }
          const handX = p > 0.5 ? rig.px - (KNUCKLE[2][0] - KNUCKLE[3][0]) * side * s : sx / sw;
          const om = 9, ze = 0.9;
          rig.vwx += (om * om * (handX - rig.wx) - 2 * ze * om * rig.vwx) * dt; rig.wx += rig.vwx * dt;
          const pressSide = [1, 2, 3, 4, 5].reduce((a, f) => a + want[f].press * (f - 3), 0);
          rig.yaw += (clamp(-rig.vwx / (kw * 45), -0.14, 0.14) - rig.yaw) * (1 - Math.exp(-dt * 6));
          rig.roll += (clamp(pressSide * 0.04 * side, -0.14, 0.14) - rig.roll) * (1 - Math.exp(-dt * 7));
          const breathe = Math.sin(t * 1.7 + (h === 'L' ? 1.3 : 0)) * 0.015 + Math.sin(t * 0.63 + (h === 'L' ? 2 : 0)) * 0.01;
          // Place the glove: the middle knuckle in front of the keys (lower on the screen) by most of
          // a finger and a third of a finger above them, tilted down a little towards the keys.
          const fl = (LENGTHS[3][0] + LENGTHS[3][1] + LENGTHS[3][2]) * s;
          const keyY = p > 0.5 ? rig.py : rig.fingers[2].y;
          rig.root.scale.set(side * s, s, s);
          rig.root.rotation.set(-(0.1 + breathe), rig.roll, rig.yaw, 'ZXY');
          rig.root.position.set(0, 0, 0); rig.root.updateMatrixWorld(true);
          const k3 = rig.root.localToWorld(v(...KNUCKLE[3]));
          rig.root.position.set(rig.wx - k3.x, -(keyY + fl * 0.6) - k3.y, fl * 0.56 - k3.z);
          rig.root.updateMatrixWorld(true);

          for (const fg of rig.fingers) {
            const f = fg.f, thumb = f === 1;
            const M = v(...KNUCKLE[f]);
            const len = LENGTHS[f];
            // The finger's down direction: the thumb bends in towards the palm (opposition).
            const down = thumb ? v(0.55, 0, -0.84).normalize() : v(0, 0, -1);
            if (p > 0.5 && f !== 2) {
              fg.theta = [fg.theta[0] + ((thumb ? 0.55 : 1.2) - fg.theta[0]) * 0.25, fg.theta[1] + ((thumb ? 0.7 : 1.4) - fg.theta[1]) * 0.25];
            } else {
              const w = want[f];
              const pointing = p > 0.5 && f === 2;
              const T = rig.root.worldToLocal(v(pointing ? rig.px : fg.x, -(pointing ? rig.py : fg.y), pointing ? s * 0.22 : w.z));
              const rel = T.clone().sub(M);
              const spread = SPREAD[f];
              fg.abd += (clamp(Math.atan2(rel.x, Math.max(0.05, rel.y)), spread - (thumb ? 0.6 : 0.3), spread + (thumb ? 0.6 : 0.3)) - fg.abd) * 0.5;
              const plane = v(Math.sin(fg.abd), Math.cos(fg.abd), 0);
              solve(fg, len, rel.dot(plane), rel.dot(down), thumb ? [-0.2, 0.9, 0.05, 1.0] : [-0.3, 1.3, 0.2, 1.7]);
            }
            const plane = v(Math.sin(fg.abd), Math.cos(fg.abd), 0);
            const [a, b] = fg.theta, c = b * 0.72;
            const seg = (ang: number, l: number) => plane.clone().multiplyScalar(Math.cos(ang) * l).addScaledVector(down, Math.sin(ang) * l);
            const P1 = M.clone(), P2 = P1.clone().add(seg(a, len[0])), P3 = P2.clone().add(seg(a + b, len[1])), P4 = P3.clone().add(seg(a + b + c, len[2]));
            place(fg.segs[0], P1, P2); place(fg.segs[1], P2, P3); place(fg.segs[2], P3, P4);
            fg.knuckles[0].position.copy(P1); fg.knuckles[1].position.copy(P2); fg.knuckles[2].position.copy(P3);
            // The number on the tip; the tip takes its hand's colour while it presses.
            fg.label.position.copy(P4).add(v(0, 0, 0.16));
            fg.label.visible = p < 0.5;
            const pressing = p < 0.5 && want[f].press > 0.6;
            fg.tipMat.color.set(pressing ? (h === 'L' ? C.L : C.R) : 0xf8f9fc);
          }
        }
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); renderer.dispose(); numTex.forEach(t => t.dispose()); host.removeChild(renderer.domElement); };
  }, [tl, now, geom, named, namedUntil]);
  return <div ref={box} className="reel-gloves" aria-hidden="true" />;
}
