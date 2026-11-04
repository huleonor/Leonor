/**
 * Records the voice of the phase videos ahead of time: Kokoro-82M (af_heart, Apache-2.0) run here
 * with onnxruntime-node, each piece trimmed of its silence and saved as a small MP3 in public/voice,
 * listed in src/lib/voiceBank.json (key: [file, seconds]). The app plays the lines from these files
 * (voice.ts, voicePieces.ts), so the voice is natural on every phone from the first video.
 *
 *   node scripts/voice-bank.mjs keys.json
 *
 * keys.json comes from the dev console: copy(JSON.stringify(await window.__voiceKeys())), with the
 * songs to record in the library. It lists every key with the text the voice is given. The bank is
 * rebuilt to exactly these keys: pieces already recorded are kept, missing ones recorded, others
 * removed. Needs ffmpeg.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { KokoroTTS } from 'kokoro-js';

const [, , input] = process.argv;
if (!input) { console.error('usage: node scripts/voice-bank.mjs keys.json'); process.exit(1); }
const want = JSON.parse(readFileSync(input, 'utf8'));
const DIR = 'public/voice', LIST = 'src/lib/voiceBank.json', VOICE = 'af_heart';
mkdirSync(DIR, { recursive: true });
const old = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : {};
const name = (text) => `${createHash('sha1').update(`${VOICE}|${text}`).digest('hex').slice(0, 12)}.mp3`;

let tts = null;
const out = {};
let made = 0;
for (const [key, text] of want) {
  const file = name(text);
  if (old[key]?.[0] === file && existsSync(`${DIR}/${file}`)) { out[key] = old[key]; continue; }
  tts ??= await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
  const audio = await tts.generate(text, { voice: VOICE });
  const f = audio.audio, rate = audio.sampling_rate;
  // Trim the silence either side, keeping 30 ms so a word is never clipped.
  let peak = 0;
  for (const x of f) peak = Math.max(peak, Math.abs(x));
  const th = peak * 0.02, pad = Math.round(rate * 0.03);
  let a = 0, b = f.length - 1;
  while (a < b && Math.abs(f[a]) < th) a++;
  while (b > a && Math.abs(f[b]) < th) b--;
  const cut = f.subarray(Math.max(0, a - pad), Math.min(f.length, b + pad));
  const enc = spawnSync('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0', '-b:a', '40k', '-y', `${DIR}/${file}`], { input: Buffer.from(cut.buffer, cut.byteOffset, cut.byteLength) });
  if (enc.status !== 0) { console.error(String(enc.stderr)); process.exit(1); }
  out[key] = [file, Math.round((cut.length / rate) * 1000) / 1000];
  if (++made % 25 === 0) console.log(`${made} recorded`);
}
// Files no key needs any more go.
const used = new Set(Object.values(out).map(v => v[0]));
for (const f of readdirSync(DIR)) if (f.endsWith('.mp3') && !used.has(f)) unlinkSync(`${DIR}/${f}`);
writeFileSync(LIST, `${JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"')}\n`);
console.log(`${Object.keys(out).length} pieces, ${made} new`);
