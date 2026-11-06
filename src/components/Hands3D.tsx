/**
 * The hands of the phase videos: real human hands in 3D (the user's choice 2026-11, after the
 * cartoon gloves looked strange), the hands of the voice that teaches. Only the hands are 3D; the
 * video stays flat (`Lanes` in Reels.tsx).
 *
 * The model: "Rigged hand" by Elena FF (Sketchfab, CC BY-SA 4.0, `public/models/hand` with its
 * licence; credited in Settings): a skinned human hand with palm volume, a deforming bone for every
 * metacarpal and phalanx. It is drawn like a comic (the user's choice 2026-11, from a piano video
 * with drawn hands): flat skin in three tones from one light and an ink line round it. The right
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
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ReelTimeline } from '../lib/reels';
import { isBlack } from '../lib/names';
import type { Hand } from '../lib/types';
import type { KeysGeom } from './Reels';
import { probe, type ProbeFinger } from '../lib/handCheck';

/** The toon ramp read in colour (three's own chunk takes only the red channel). */
const RAMP = `uniform sampler2D gradientMap;
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float dotNL = dot( normal, lightDirection );
  return texture2D( gradientMap, vec2( dotNL * 0.5 + 0.5, 0.0 ) ).rgb;
}`;

let model: Promise<THREE.Object3D> | null = null;
const loadModel = () => (model ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/hand/hand.glb`).then(g => g.scene));

const NAMES = ['', 'thumb', 'index', 'middle', 'ring', 'pinky'];
const SPREAD = [0, 0, -0.06, 0, 0.05, 0.12];
// Where each finger rests from the middle finger, in white keys, after PianoPlayer's hand model
// (Marco Musy, github.com/marcomusy/pianoplayer, MIT: -7, -2.8, 0, 2.8, 5.6 cm for a medium hand,
// 2.35 cm a key): the thumb sits well apart, the others closer, so a free finger rests where a
// real hand's would, not one key from its neighbour.
const REST_KEYS = [0, -2.4, -1, 0, 1, 2];
/** The hand points at a key the voice names (off: it flew there and back, the user found it unnatural). */
const POINT = false;
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
  wx: number; vwx: number; ky: number; vky: number; dip: number; edge: number; yaw: number; roll: number; point: number; px: number; py: number; seen: boolean; shiftWant: number;
};

export function Hands3D({ tl, now, geom, named, namedUntil }: Props) {
  const box = useRef<HTMLDivElement>(null);
  // Read live, so a change of the named key never rebuilds the renderer.
  const untilRef = useRef(namedUntil);
  untilRef.current = namedUntil;
  useEffect(() => {
    const host = box.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Sharp, but light enough for a phone: at most 1.5 pixels a point, down to 1 when frames run slow.
    let ratio = Math.min(1.5, window.devicePixelRatio || 1);
    renderer.setPixelRatio(ratio);
    let slowFrames = 0;
    host.appendChild(renderer.domElement);
    // Drawn, not photographed (the user's choice 2026-11, from a piano video with comic hands): the
    // skin is flat colour in three tones from the light, with an ink line round the hand.
    const css = getComputedStyle(host);
    const tok = (name: string, fb: string) => new THREE.Color(css.getPropertyValue(name).trim() || fb);
    const skin = tok('--hand-skin', '#F6D2B4'), shade = tok('--hand-shade', '#DCA486'), deep = tok('--hand-deep', '#B97E66');
    const line = tok('--hand-line', '#3A2620');
    // The bands of the toon ramp hold the skin's three tones exactly: the material is white and the
    // ramp itself is coloured, so the light only chooses the band.
    const ramp = new Uint8Array(4 * 3);
    const srgb = { r: 0, g: 0, b: 0 };
    [deep, shade, skin].forEach((c, i) => { c.getRGB(srgb, THREE.SRGBColorSpace); ramp.set([srgb.r * 255, srgb.g * 255, srgb.b * 255, 255], i * 4); });
    const gradient = new THREE.DataTexture(ramp, 3, 1, THREE.RGBAFormat);
    gradient.colorSpace = THREE.SRGBColorSpace;
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
    const outline = new OutlineEffect(renderer, { defaultThickness: 0.006, defaultColor: [line.r, line.g, line.b], defaultAlpha: 1, defaultKeepAlive: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 1, 20000);
    // One light from above the music stand, a little from the left, as in a drawing; at pi it gives
    // back the ramp's colours exactly (Lambert divides by pi), with nothing else lighting the skin.
    const key = new THREE.DirectionalLight(0xffffff, Math.PI); key.position.set(-0.5, 0.7, 1); scene.add(key);

    const rigs: Partial<Record<Hand, Rig>> = {};
    let alive = true;
    // Each hand's widest stretch in this video, in white keys: notes that sound together, or one
    // straight after another.
    const whiteIdx = (m: number) => Math.floor(m / 12) * 7 + [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][m % 12];
    const stretch: Partial<Record<Hand, number>> = {};
    for (const h of ['L', 'R'] as Hand[]) {
      const ns = tl.notes.filter(n => n.hand === h);
      let w = 0;
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length && ns[j].t - ns[i].t < 0.2; j++) w = Math.max(w, Math.abs(whiteIdx(ns[j].midi) - whiteIdx(ns[i].midi)));
      stretch[h] = w;
    }
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
            const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
            // three's toon ramp reads only its red channel; this one is read in colour.
            mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <gradientmap_pars_fragment>', RAMP); };
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
            hover: rnd(f + (h === 'L' ? 10 : 0)), stiff: 24 + rnd(f * 3 + (h === 'L' ? 5 : 0)) * 8,
          });
        }
        const span = W(bones.get('index_01')!).distanceTo(W(bones.get('pinky_01')!));
        const length = W(bones.get('middle_01')!).distanceTo(wrist) + fingers[2].len.reduce((a, b) => a + b, 0);
        rigs[h] = { h, root, fingers, all: sk.bones, restAll: sk.bones.map(b => b.quaternion.clone()), align, fwd, back, span, length, wx: 0, vwx: 0, ky: 0, vky: 0, dip: 0, edge: 0, yaw: 0, roll: 0, point: 0, px: 0, py: 0, seen: false, shiftWant: 0 };
      }).catch(err => console.warn('[hands] the hand model could not load:', err));
    }

    const q = new THREE.Quaternion();
    /** Turn a bone so it points at a world position, from its rest rotation (keeps its roll). */
    const aim = (b: THREE.Bone, rest: THREE.Quaternion, axis: THREE.Vector3, target: THREE.Vector3) => {
      b.quaternion.copy(rest);
      b.updateWorldMatrix(true, false);
      // In the parent's own space, so the mirrored left hand turns the right way too (a world
      // quaternion cannot hold the mirror).
      const want = b.parent!.worldToLocal(target.clone()).sub(b.position).normalize();
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
      for (let it = 0; it < 16; it++) {
        const [x, y] = planar(len, a, b);
        const ex = u - x, ey = d - y;
        if (ex * ex + ey * ey < (0.004 * L) ** 2) break;
        const e = 1e-3;
        const [xa, ya] = planar(len, a + e, b), [xb, yb] = planar(len, a, b + e);
        const j11 = (xa - x) / e, j21 = (ya - y) / e, j12 = (xb - x) / e, j22 = (yb - y) / e;
        const A11 = j11 * j11 + j21 * j21 + lam, A12 = j11 * j12 + j21 * j22, A22 = j12 * j12 + j22 * j22 + lam;
        const g1 = j11 * ex + j21 * ey, g2 = j12 * ex + j22 * ey, det = A11 * A22 - A12 * A12;
        if (Math.abs(det) < 1e-12) break;
        let da = (A22 * g1 - A12 * g2) / det, db = (-A12 * g1 + A11 * g2) / det;
        // A joint at its limit and pushed further stays there while the other is solved alone;
        // steps are kept short so the solver never jumps into a claw it cannot climb out of.
        const pinA = (a <= lim[0] + 1e-6 && da < 0) || (a >= lim[1] - 1e-6 && da > 0);
        const pinB = (b <= lim[2] + 1e-6 && db < 0) || (b >= lim[3] - 1e-6 && db > 0);
        if (pinA && pinB) break;
        if (pinA) { da = 0; db = g2 / A22; } else if (pinB) { db = 0; da = g1 / A11; }
        const m = Math.max(Math.abs(da), Math.abs(db));
        if (m > 0.25) { da *= 0.25 / m; db *= 0.25 / m; }
        a = clamp(a + da, lim[0], lim[1]);
        b = clamp(b + db, lim[2], lim[3]);
      }
      fg.theta = [a, b];
    };

    let raf = 0, last = performance.now();
    // Only the video on screen draws its hands: the feed keeps its neighbours mounted, and three
    // renderers at once halved the frame rate on a phone.
    let onScreen = true;
    const io = new IntersectionObserver(es => { for (const e of es) onScreen = e.isIntersecting && e.intersectionRatio > 0.5; }, { threshold: [0, 0.5, 1] });
    io.observe(host);
    const id = Math.random().toString(36).slice(2, 7);
    const cams: Record<'L' | 'R' | 'both', { m: number; xa: number; xb: number } | null> = { L: null, R: null, both: null };
    const draw = () => {
      const G = geom.current;
      const Wd = host.clientWidth, Ht = host.clientHeight;
      if (!onScreen) last = performance.now();
      else if (G && Wd > 0 && Ht > 0) {
        const nowMs = performance.now(), dt = Math.min(0.12, (nowMs - last) / 1000);
        slowFrames = nowMs - last > 26 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames > 30 && ratio > 1) { ratio = 1; renderer.setPixelRatio(1); slowFrames = 0; }
        last = nowMs;
        const pr = renderer.getPixelRatio();
        if (renderer.domElement.width !== Math.round(Wd * pr) || renderer.domElement.height !== Math.round(Ht * pr)) renderer.setSize(Wd, Ht);
        camera.aspect = Wd / Ht;
        const D = (Ht / 2) / Math.tan((camera.fov * Math.PI) / 360);
        camera.position.set(Wd / 2, -Ht / 2, D); camera.lookAt(Wd / 2, -Ht / 2, 0); camera.updateProjectionMatrix();
        const t = now();
        const namedKey = t < untilRef.current && named.current && named.current.size ? [...named.current.entries()].sort((a, b) => b[1] - a[1])[0][0] : undefined;
        // The camera glides along the keys: everything the hands hold in screen pixels moves with
        // it first, so a hand never trails behind its keys while the picture moves.
        // On a keyboard cut in two, each half has its own camera: each hand follows its own half
        // (the left hand the left half), anchored on two keys an octave apart inside it.
        for (const h of (G.side ? ['L', 'R'] : ['both']) as ('L' | 'R' | 'both')[]) {
          const want = h === 'L' ? 0 : 1;
          let ma = 0;
          for (let m = 24; m < 100; m++) if (G.X(m) && G.X(m + 12) && (!G.side || (G.side(m) === want && G.side(m + 12) === want))) { ma = m; break; }
          const prev = cams[h];
          if (!ma) { cams[h] = null; continue; }
          const xa = G.X(ma)!.x, xb = G.X(ma + 12)!.x;
          if (prev && prev.m === ma && prev.xb !== prev.xa) {
            const a = (xb - xa) / (prev.xb - prev.xa), b0 = xa - a * prev.xa;
            if (Math.abs(a - 1) > 1e-4 || Math.abs(b0) > 0.05) {
              for (const rig of Object.values(rigs)) {
                if (!rig || (h !== 'both' && rig.h !== h)) continue;
                rig.wx = a * rig.wx + b0; rig.vwx *= a; rig.px = a * rig.px + b0;
                for (const fg of rig.fingers) { fg.x = a * fg.x + b0; fg.vx *= a; }
              }
            }
          }
          cams[h] = { m: ma, xa, xb };
        }
        const cam = cams.both ?? cams.R ?? cams.L;
        // A white key's pitch on screen (unitW is the key's own width, narrower than its step).
        let kw = G.unitW;
        for (let m = 60; m < 84; m++) {
          if (isBlack(m)) continue;
          const n = isBlack(m + 1) ? m + 2 : m + 1, a = G.X(m), b = G.X(n);
          if (a && b && b.x > a.x) { kw = b.x - a.x; break; }
        }
        for (const h of ['L', 'R'] as Hand[]) {
          const rig = rigs[h];
          if (!rig) continue;
          const dir = h === 'R' ? 1 : -1;
          const mine = tl.notes.filter(n => n.hand === h && n.finger);
          // Size: knuckles of index to little finger over about four white keys (big enough to span an
          // octave with the thumb, like the hands in the video he liked);
          // the forearm may leave the screen at the bottom, the hand itself never.
          // A video with octaves in this hand gets a hand that spans them (thumb to little finger).
          const keysAcross = Math.max(3.9, (stretch[h] ?? 0) * 0.6);
          const s = Math.min((kw * keysAcross) / rig.span, (Ht - G.kbTop) * (Wd > Ht ? 2.6 : 1.6) / rig.length);
          rig.root.scale.setScalar(s);
          const fl = rig.fingers[2].len.reduce((a, b) => a + b, 0) * s;
          // A free finger rests a key along from its neighbour, or closer when the keys are wide and
          // the hand would have to splay: never wider than its own knuckles allow.
          const step = Math.min(kw * 0.95, (rig.span * s) / 3 * 1.05);
          // Each finger's next note: where on the key, and its press envelope from the note times.
          const want: { x?: number; y: number; z: number; real: boolean; soon: number; press: number; since?: number; gap?: number; n?: { midi: number; t: number; dur: number }; kx?: number }[] = [];
          // Fingers look ahead 1.4 s; a hand with nothing that near (resting between its entries)
          // waits over the next notes it will play rather than where it last was, so it never sits
          // on the other hand.
          const near = (h0: number) => mine.some(n => n.t + n.dur > t - 0.12 && n.t < t + h0) || mine.some(n => n.t <= t && n.t + n.dur > t - 0.6);
          const horizon = rig.seen && near(1.4) ? 1.4 : 1e9;
          for (let f = 1; f <= 5; f++) {
            const ns = mine.filter(n => n.finger === f);
            // A finger goes to its next note only when it is near (or the last one it played, just
            // after); a note far ahead would drag it over its neighbours' keys.
            const nx = ns.find(n => n.t + n.dur > t - 0.12 && n.t < t + horizon) ?? [...ns].reverse().find(n => n.t <= t && n.t + n.dur > t - 0.6);
            const k = nx && G.X(nx.midi);
            const hover = fl * (0.07 + 0.05 * rig.fingers[f - 1].hover);
            if (nx && k) {
              const black = isBlack(nx.midi);
              // A black key stands above the white ones: the finger lifts a little higher to clear
              // it, strikes its top and sinks in by the key's own depth, so the press reads.
              const top = black ? fl * 0.09 : 0, depth = fl * (black ? 0.05 : 0.03);
              let z = hover + top, press = 0;
              const t0 = nx.t, t1 = nx.t + Math.max(0.12, nx.dur * 0.92), lift = fl * (black ? 0.24 : 0.2) + top;
              if (t < t0 - 0.3) z = hover + top;
              else if (t < t0 - 0.09) z = hover + top + (lift - hover - top) * smooth((t - (t0 - 0.3)) / 0.21);
              else if (t < t0) { const e = (t - (t0 - 0.09)) / 0.09; z = lift + (top - depth - lift) * e * e * (3 - 2 * e) * (0.4 + 0.6 * e); press = e; }
              else if (t < t1) { z = top - depth; press = 1; }
              else if (t < t1 + 0.2) { const e = smooth((t - t1) / 0.2); z = top - depth + (hover + depth) * e; press = 1 - e; }
              // Into the black keys and out again gradually, as the note comes, not in one jump.
              const restY = G.kbTop + G.kbH * (f === 1 ? 0.88 : 0.6);
              const keyY = G.kbTop + G.kbH * (black ? 0.3 : f === 1 ? 0.88 : 0.6);
              const soon = Math.max(0, t0 - t), into = t >= t0 ? 1 : smooth(1 - soon / 0.7);
              want[f] = { x: k.x + k.w / 2, y: restY + (keyY - restY) * into, z, real: true, soon, press, since: Math.max(0, t - t0), gap: nx.t - mine.reduce((a, n) => (n.t < nx.t - 0.01 && n.t > a ? n.t : a), -1e9), n: nx, kx: k.x + k.w / 2 };
            } else want[f] = { y: G.kbTop + G.kbH * 0.6, z: hover * 1.8, real: false, soon: 9, press: 0 };
          }
          for (let f = 1; f <= 5; f++) if (want[f].x === undefined) {
            let best: number | undefined, bd = 9;
            for (let g = 1; g <= 5; g++) if (want[g].real && Math.abs(g - f) < bd) { bd = Math.abs(g - f); best = want[g].x! + (REST_KEYS[f] - REST_KEYS[g]) * dir * step; }
            want[f].x = best;
          }
          if (want.slice(1).some(w => w.x === undefined)) {
            // Nothing near for this hand: it rests where it last was.
            if (!rig.seen) { rig.root.visible = false; continue; }
            for (let f = 1; f <= 5; f++) if (want[f].x === undefined) want[f].x = rig.fingers[f - 1].x;
          }
          // The fingers keep their order across the keys: one not about to play is moved out of its
          // neighbour's way, outwards from the index.
          const busy = (f: number) => want[f].real && (want[f].press > 0 || want[f].soon < 0.35);
          for (let f = 3; f <= 5; f++) {
            const gap = dir * (want[f].x! - want[f - 1].x!);
            if (gap < step * 0.8) {
              if (!busy(f)) want[f].x = want[f - 1].x! + dir * step;
              else if (!busy(f - 1)) want[f - 1].x = want[f].x! - dir * step;
            }
          }
          for (let f = 4; f >= 2; f--) {
            const gap = dir * (want[f + 1].x! - want[f].x!);
            if (gap < step * 0.8 && !busy(f)) want[f].x = want[f + 1].x! - dir * step;
          }
          rig.root.visible = true;
          // Tendons: a pressing finger pulls its neighbours down a little.
          for (let f = 2; f <= 5; f++) for (const g of [f - 1, f + 1]) if (g >= 2 && g <= 5 && want[g].press > 0.5 && want[f].press < 0.2) want[f].z -= fl * 0.03 * want[g].press;
          // It points at a key the voice names only while it has nothing to play: a note due within
          // 0.7 s wins, so the hand is there when it sounds (the check found it still pointing).
          const due = [1, 2, 3, 4, 5].some(f => want[f].real && (want[f].press > 0 || want[f].soon < 0.7));
          // Pointing is off (the user found the hands' moves unnatural, 2026-11: the hand flew to
          // point at a named key and back): the key is outlined and numbered on the keyboard instead.
          const pk = POINT && !due && namedKey !== undefined && (handOf.get(namedKey) ?? (namedKey < 60 ? 'L' : 'R')) === h ? G.X(namedKey) : null;
          if (!rig.seen) {
            for (const fg of rig.fingers) { fg.x = want[fg.f].x!; fg.y = want[fg.f].y; }
            rig.wx = want[3].x!; rig.px = want[2].x!; rig.py = want[2].y; rig.seen = true;
          }
          // Damped springs, stepped finely so they stay stable on a slow frame.
          const steps = Math.max(1, Math.ceil(dt / 0.006)), h2 = dt / steps;
          for (const fg of rig.fingers) {
            const w = want[fg.f], om = fg.stiff, ze = 0.9;
            for (let k = 0; k < steps; k++) {
              fg.vx += (om * om * (w.x! - fg.x) - 2 * ze * om * fg.vx) * h2; fg.x += fg.vx * h2;
              fg.vy += (om * om * (w.y - fg.y) - 2 * ze * om * fg.vy) * h2; fg.y += fg.vy * h2;
            }
          }
          rig.point += ((pk ? 1 : 0) - rig.point) * (1 - Math.exp(-dt * 8));
          if (pk) { rig.px += (pk.x + pk.w / 2 - rig.px) * (1 - Math.exp(-dt * 10)); rig.py += (G.kbTop + G.kbH * 0.45 - rig.py) * (1 - Math.exp(-dt * 10)); }
          const p = rig.point;
          // The wrist, led by the notes about to sound, on its own slower spring; a note already held
          // pulls less and less, so the hand leaves it for the next one (the pedal keeps it sounding);
          // it sets off at most halfway through the gap since the hand's last note, so between quick
          // far notes it still sits on each one as it sounds. The thumb is short from the knuckles, so
          // its note pulls twice as hard.
          let sx = 0, sw = 0;
          // A note coming: the notes already held weigh little on the wrist (and almost nothing more
          // than five keys from it), so the hand goes where it plays next; a held finger that still
          // reaches its key keeps it. A held note lets go of the wrist as a hand leaves a key on a leap and the pedal
          // keeps it sounding (the check found the wrist left halfway on a B to high C).
          const coming = [1, 2, 3, 4, 5].filter(g => want[g].real && want[g].soon > 0 && want[g].soon < 0.45).map(g => want[g].x!);
          for (let f = 1; f <= 5; f++) { const far = want[f].real ? Math.abs(want[f].x! - rig.wx) / kw : 0; const lead = Math.min(0.25 + Math.min(0.55, far * 0.06), Math.max(0.12, (want[f].gap ?? 9) * 0.5)); const held = want[f].real && want[f].soon === 0 && (want[f].since ?? 0) > 0.2 && coming.length > 0; const left = !held ? 1 : coming.some(x => Math.abs(x - want[f].x!) > kw * 5) ? 0.08 : 0.15; const w = want[f].real ? left / (0.06 + Math.max(0, want[f].soon - lead) + 0.6 * Math.max(0, (want[f].since ?? 0) - 0.15)) : 0.15; const wt = f === 1 && want[f].real ? w * 2 : w; sx += ((want[f].real ? want[f].x! : rig.fingers[f - 1].x) - (f - 3) * dir * (rig.span * s) / 3) * wt; sw += wt; }
          const handX = p > 0.5 ? rig.px + dir * kw * 0.9 : sx / sw;
          // A stiff, critically damped spring (no overshoot), towards a target that already leans on
          // the notes coming in the next quarter second (earlier for a far jump, about 0.06 s a key,
          // so a hand crossing over arrives on time), so the hand arrives with them, not after.
          const om = 20, ze = 1;
          // The thumb and the little finger reach sideways only so far from their knuckles: while one
          // is on its key and still misses it sideways, the wrist's target slides over by the miss
          // (measured last frame, at most 1.2 keys, only when the tip is short of its key), as a pianist's hand does on an octave,
          // and comes back as soon as it lets go (the check found the thumb half a key short).
          const aimX = handX + rig.shiftWant;
          for (let k = 0; k < steps; k++) { rig.vwx += (om * om * (aimX - rig.wx) - 2 * ze * om * rig.vwx) * h2; rig.wx += rig.vwx * h2; }
          const pressSide = [1, 2, 3, 4, 5].reduce((a, f) => a + want[f].press * (f - 3), 0);
          rig.yaw += (clamp(-rig.vwx / (kw * 45), -0.12, 0.12) - rig.yaw) * (1 - Math.exp(-dt * 6));
          rig.roll += (clamp(pressSide * 0.07 * dir, -0.22, 0.22) - rig.roll) * (1 - Math.exp(-dt * 9));
          const breathe = Math.sin(t * 1.7 + (h === 'L' ? 1.3 : 0)) * 0.012 + Math.sin(t * 0.63 + (h === 'L' ? 2 : 0)) * 0.008;
          rig.root.quaternion.setFromEuler(new THREE.Euler(0.1 + breathe, rig.roll, rig.yaw, 'ZXY')).multiply(rig.align);
          // Reset the pose, then place the hand: the middle knuckle in front of the keys (lower on
          // the screen) by most of a finger and about half a finger above them.
          rig.all.forEach((b, i) => b.quaternion.copy(rig.restAll[i]));
          rig.root.position.set(0, 0, 0);
          rig.root.updateMatrixWorld(true);
          const k3 = rig.fingers[2].bones[0].getWorldPosition(v());
          // The hand moves in towards the black keys when a finger is about to play one, so every
          // finger can reach its key with a soft curve (it never stretches flat to get there).
          // Each finger's want eases in as its note comes (its y already does), and the hand follows
          // on a critically damped spring: it glides forward and back, never overshoots.
          const restY = G.kbTop + G.kbH * 0.6;
          let reachY = restY;
          for (let f = 1; f <= 5; f++) if (want[f].real && want[f].soon < 1) reachY = Math.min(reachY, want[f].y + (f === 1 ? -G.kbH * 0.5 : 0));
          const kyWant = p > 0.5 ? rig.py : reachY;
          if (!rig.ky) rig.ky = kyWant;
          for (let k = 0; k < steps; k++) { rig.vky += (144 * (kyWant - rig.ky) - 2 * 12 * rig.vky) * h2; rig.ky += rig.vky * h2; }
          const keyY = rig.ky;
          // The hand gives a little with each press, from the wrist, so a strike is felt in the arm.
          const pressNow = Math.max(...[1, 2, 3, 4, 5].map(f => want[f].press));
          rig.dip += (pressNow - rig.dip) * (1 - Math.exp(-dt * 12));
          // The thumb and the little finger are short from the knuckle line: the hand rolls over to
          // them and comes down a little, as a pianist's forearm turns, so they reach their keys.
          const edgeNow = Math.max(want[1].press, want[5].press, want[1].real ? smooth(1 - want[1].soon / 0.25) : 0, want[5].real ? smooth(1 - want[5].soon / 0.25) : 0);
          rig.edge += (edgeNow - rig.edge) * (1 - Math.exp(-dt * 14));
          rig.root.position.set(rig.wx - k3.x, -(keyY + fl * 0.55) - k3.y, fl * (0.44 - 0.035 * rig.dip - 0.1 * rig.edge) - k3.z);
          rig.root.updateMatrixWorld(true);

          // The hand's frame in the world, for the fingers' planes.
          const Fw = rig.fwd.clone().applyQuaternion(rig.root.quaternion).normalize();
          const Dn = rig.back.clone().applyQuaternion(rig.root.quaternion).normalize().negate();
          const Ac = v().crossVectors(Dn, Fw).normalize();
          const farOf: boolean[] = [], missX: number[] = [];
          for (const fg of rig.fingers) {
            const f = fg.f, thumb = f === 1;
            const M = fg.bones[0].getWorldPosition(v());
            const len = fg.len.map(l => l * s);
            // The thumb bends in towards the palm (opposition), the others straight down.
            const toPalm = Ac.clone().multiplyScalar(-dir);
            const down = thumb ? Dn.clone().multiplyScalar(0.8).addScaledVector(toPalm, 0.6).normalize() : Dn.clone();
            const lim: [number, number, number, number] = thumb ? [-0.7, 0.9, 0.0, 1.4] : [-0.25, 1.35, 0.18, 1.75];
            /** Turns the finger's bones to its angles; gives back where its tip lands. */
            // The bending plane: forward turned by the abduction, and down squared against it (the
            // thumb's down leans in to the palm; left oblique, a wide thumb landed a key outside its key).
            const downOf = (pl: THREE.Vector3) => down.clone().addScaledVector(pl, -down.dot(pl)).normalize();
            const pose = () => {
              const plane = Fw.clone().applyAxisAngle(Dn, fg.abd), dn = downOf(plane);
              const [a, b] = fg.theta, c = b * 0.72;
              const seg = (ang: number, l: number) => plane.clone().multiplyScalar(Math.cos(ang) * l).addScaledVector(dn, Math.sin(ang) * l);
              const P2 = M.clone().add(seg(a, len[0])), P3 = P2.clone().add(seg(a + b, len[1])), P4 = P3.clone().add(seg(a + b + c, len[2]));
              aim(fg.bones[0], fg.rest[0], fg.axis[0], P2);
              aim(fg.bones[1], fg.rest[1], fg.axis[1], P3);
              aim(fg.bones[2], fg.rest[2], fg.axis[2], P4);
              return fg.ends[2].getWorldPosition(v());
            };
            if (p > 0.5 && f !== 2) {
              fg.theta = [fg.theta[0] + ((thumb ? 0.5 : 1.15) - fg.theta[0]) * 0.25, fg.theta[1] + ((thumb ? 0.7 : 1.45) - fg.theta[1]) * 0.25];
              pose();
              continue;
            }
            const w = want[f];
            const pointing = p > 0.5 && f === 2;
            // A finger about to play (or playing) lands on its key itself, not on its lagging spring.
            const lock = pointing ? 0 : w.real ? Math.max(w.press, smooth(1 - w.soon / 0.28)) : 0;
            const tx = fg.x + (w.x! - fg.x) * lock, ty = fg.y + (w.y - fg.y) * lock;
            const T = v(pointing ? rig.px : tx, -(pointing ? rig.py : ty), pointing ? fl * 0.35 : w.z);
            const rel = T.clone().sub(M);
            const sp = SPREAD[f] * dir;
            const lat = rel.dot(Ac), fwdD = Math.max(1, rel.dot(Fw));
            const range = thumb ? 1.1 : f === 5 ? 0.6 : f === 2 ? 0.38 : 0.32;
            fg.abd += (clamp(Math.atan2(lat, fwdD), sp - range, sp + range) - fg.abd) * (lock > 0.5 ? 1 : 0.5);
            const plane = Fw.clone().applyAxisAngle(Dn, fg.abd);
            // A key out of this finger's reach (wide keys on a big screen): it stays relaxed in its
            // own lane instead of twisting after it.
            const Lf = len[0] + len[1] + len[2];
            const off = Math.abs(rel.dot(v().crossVectors(Dn, plane).normalize()));
            const far = off > Lf * (thumb ? 0.95 : f === 5 ? 0.65 : 0.45);
            farOf[f] = far;
            let u = far ? Lf * 0.62 : rel.dot(plane), d = far ? Lf * 0.5 : rel.dot(downOf(plane));
            solve(fg, len, u, d, lim);
            let tip = pose();
            // The model's fingertip is not exactly at the end of the solved chain (the bones' own
            // bend, the pad of the finger): where it must hit a key, the miss is measured on the
            // posed hand and folded back into the target, twice, so it lands on the key.
            // An idle finger gets two passes too, so it hovers where it was asked and never rests
            // inside the keys (the quality check found the thumb below them a third of the time).
            if (!far) {
              const passes = lock > 0 || pointing ? (thumb ? 5 : 3) : 2;
              // The best pose found is kept: a key out of reach must not send the finger past it. It is
              // judged on the keys. plane first (where the tip lands); a tip too high counts half, one
              // inside the keys one and a half.
              const miss = (p: THREE.Vector3) => Math.hypot(p.x - T.x, p.y - T.y, (p.z - T.z) * (p.z < T.z ? 1.5 : 0.5));
              let best = { e: miss(tip), th: [...fg.theta] as [number, number], abd: fg.abd };
              for (let k = 0; k < passes; k++) {
                const err = T.clone().sub(tip);
                if (miss(tip) < best.e) best = { e: miss(tip), th: [...fg.theta] as [number, number], abd: fg.abd };
                if (err.length() < Lf * 0.01) break;
                const pl = Fw.clone().applyAxisAngle(Dn, fg.abd), side = v().crossVectors(Dn, pl).normalize();
                fg.abd = clamp(fg.abd + Math.atan2(err.dot(side), Math.max(Lf * 0.5, u)), sp - range - 0.1, sp + range + 0.1);
                u += err.dot(pl); d += err.dot(downOf(pl));
                solve(fg, len, u, d, lim);
                tip = pose();
              }
              if (miss(tip) > best.e) { fg.theta = best.th; fg.abd = best.abd; tip = pose(); }
              // Only a tip short of its key (the key further out than the tip) moves the hand.
              if ((f === 1 || f === 5) && lock > 0.5 && Math.sign(T.x - tip.x) === Math.sign(T.x - rig.wx)) missX[f] = T.x - tip.x;
            }
          }
          const edgeMiss = (missX[1] ?? 0) + (missX[5] ?? 0);
          if (missX[1] !== undefined || missX[5] !== undefined) rig.shiftWant = clamp(rig.shiftWant + edgeMiss * Math.min(1, dt * 12), -kw * 1.2, kw * 1.2);
          else rig.shiftWant *= Math.exp(-dt * 14);
          // The quality check (handCheck.ts, dev only) reads every frame while it records.
          if (probe.frames) {
            const fingers: ProbeFinger[] = rig.fingers.map(fg => {
              const tp = fg.ends[2].getWorldPosition(v()), w = want[fg.f];
              return { x: tp.x, y: -tp.y, z: tp.z, press: w.press, wz: w.z, midi: w.n?.midi, kx: w.kx, on: w.n?.t, off: w.n ? w.n.t + w.n.dur : undefined, far: !!farOf[fg.f] };
            });
            probe.frames.push({ id, t, ms: nowMs, h, kw, fl, wx: rig.wx, x0: cam?.xa ?? 0, fingers });
          }
        }
        outline.render(scene, camera);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; io.disconnect(); cancelAnimationFrame(raf); gradient.dispose(); renderer.dispose(); renderer.forceContextLoss(); host.removeChild(renderer.domElement); };
  }, [tl, now, geom, named]);
  return <div ref={box} className="reel-gloves" aria-hidden="true" />;
}
