/// <reference lib="webworker" />
/**
 * The natural voice: Kokoro-82M (Apache-2.0) run on the device with transformers.js, in a worker so
 * the videos never stutter. The model (about 90 MB, quantised) is fetched once from Hugging Face and
 * kept by the browser; no server, no key. Messages: load, then say { id, text } answered with the
 * audio as 16-bit samples and its rate.
 */
import { KokoroTTS } from 'kokoro-js';

let tts: Promise<KokoroTTS> | null = null;
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';

function load() {
  if (!tts) {
    tts = (async () => {
      // WebGPU only where an adapter really answers; otherwise the quantised model on WebAssembly.
      const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
      const gpu = !!(await nav.gpu?.requestAdapter().catch(() => null));
      return KokoroTTS.from_pretrained(MODEL, { dtype: gpu ? 'fp32' : 'q8', device: gpu ? 'webgpu' : 'wasm' });
    })();
  }
  return tts;
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: 'load' } | { type: 'say'; id: string; text: string; voice: string };
  try {
    if (m.type === 'load') { await load(); (self as unknown as Worker).postMessage({ type: 'ready' }); return; }
    const model = await load();
    const audio = await model.generate(m.text, { voice: m.voice as 'af_heart' });
    const f = audio.audio as Float32Array;
    const pcm = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-1, Math.min(1, f[i])) * 32767;
    (self as unknown as Worker).postMessage({ type: 'audio', id: m.id, pcm, rate: audio.sampling_rate }, [pcm.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', id: 'id' in m ? m.id : undefined, error: String(err) });
  }
};
