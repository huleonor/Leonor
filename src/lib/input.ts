import { PitchDetector } from 'pitchy';
import { audioContext, setAudioSession } from './audio';

export type Source = 'midi' | 'ble' | 'mic';
export interface NoteEvent { type: 'on' | 'off'; midi: number; velocity: number; source: Source; }
type Handler = (e: NoteEvent) => void;
export type LinkState = { status: 'off' | 'connecting' | 'on' | 'error'; label?: string; error?: string };
type StateHandler = (s: Record<Source, LinkState>) => void;

const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
const BLE_MIDI_CHAR = '7772e5db-3868-4112-a1a9-f2669d106bf3';

const handlers = new Set<Handler>();
const stateHandlers = new Set<StateHandler>();
const state: Record<Source, LinkState> = { midi: { status: 'off' }, ble: { status: 'off' }, mic: { status: 'off' } };

export function onNote(h: Handler) { handlers.add(h); return () => { handlers.delete(h); }; }
export function onLinkState(h: StateHandler) { stateHandlers.add(h); h({ ...state }); return () => { stateHandlers.delete(h); }; }
function emit(e: NoteEvent) { handlers.forEach(h => h(e)); }
function setState(src: Source, s: LinkState) { state[src] = s; stateHandlers.forEach(h => h({ ...state })); }
export const linkState = () => ({ ...state });

export const support = {
  webMidi: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
  bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  mic: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  isIOS: typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)),
};

/** Shared parser for raw MIDI bytes (status + data). */
function handleMidiMessage(status: number, d1: number, d2: number, source: Source) {
  const cmd = status & 0xf0;
  if (cmd === 0x90 && d2 > 0) emit({ type: 'on', midi: d1, velocity: d2, source });
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) emit({ type: 'off', midi: d1, velocity: 0, source });
}

// ---------------- Web MIDI (USB, or Bluetooth paired in the OS) ----------------
let midiAccess: MIDIAccess | null = null;

/** Software loopback ports are not a keyboard. */
const VIRTUAL_PORT = /through|iac driver|loopmidi|virtual/i;

function bindMidiInputs(quiet: boolean) {
  if (!midiAccess) return;
  const names: string[] = [];
  midiAccess.inputs.forEach(input => {
    if (input.state !== 'connected' || VIRTUAL_PORT.test(input.name ?? '')) return;
    names.push(input.name ?? '');
    input.onmidimessage = (ev: MIDIMessageEvent) => {
      const d = ev.data;
      if (d && d.length >= 3) handleMidiMessage(d[0], d[1], d[2], 'midi');
    };
  });
  if (names.length) setState('midi', { status: 'on', label: names[0] || undefined });
  else setState('midi', quiet ? { status: 'off' } : { status: 'error', error: 'in.noMidiDevice' });
}

/** `quiet`: no error when nothing is plugged in yet; plugging a keyboard in later still connects it. */
export async function connectWebMidi(quiet = false) {
  if (!support.webMidi) {
    if (!quiet) setState('midi', { status: 'error', error: support.isIOS ? 'in.iosMidi' : 'in.noMidiSupport' });
    return;
  }
  if (midiAccess) { bindMidiInputs(quiet); return; }
  if (!quiet) setState('midi', { status: 'connecting' });
  try {
    midiAccess = await navigator.requestMIDIAccess();
    bindMidiInputs(quiet);
    // Cable plugged in or pulled out: rebind without asking again.
    midiAccess.onstatechange = () => bindMidiInputs(true);
  } catch {
    midiAccess = null;
    setState('midi', quiet ? { status: 'off' } : { status: 'error', error: 'in.midiDenied' });
  }
}

/**
 * Watch for a keyboard on a cable from the start. If MIDI permission is already granted this
 * connects right away; otherwise it asks once, on the first tap anywhere (browsers need a gesture).
 */
export async function watchForMidi() {
  if (!support.webMidi) return;
  let granted = false;
  try {
    const p = await navigator.permissions.query({ name: 'midi' as PermissionName });
    granted = p.state === 'granted';
  } catch { /* permissions API without 'midi': fall through to the gesture */ }
  if (granted) { connectWebMidi(true); return; }
  const onFirstTap = () => {
    window.removeEventListener('pointerdown', onFirstTap, true);
    connectWebMidi(true);
  };
  window.addEventListener('pointerdown', onFirstTap, true);
}

// ---------------- Bluetooth LE MIDI (Web Bluetooth) ----------------
let bleDevice: BluetoothDevice | null = null;

function parseBlePacket(data: DataView) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.length < 3) return;
  let i = 1; // byte 0 is the packet header (timestamp high)
  let status = 0;
  while (i < bytes.length) {
    let b = bytes[i];
    if (b & 0x80) {
      // Timestamp byte. A status byte may follow; otherwise running status.
      i++;
      if (i >= bytes.length) break;
      b = bytes[i];
      if (b & 0x80) { status = b; i++; }
    }
    if (!status) { i++; continue; }
    const cmd = status & 0xf0;
    if (status === 0xf0) { // SysEx: skip to end
      while (i < bytes.length && bytes[i] !== 0xf7) i++;
      i++; status = 0; continue;
    }
    const len = cmd === 0xc0 || cmd === 0xd0 ? 1 : status >= 0xf0 ? 0 : 2;
    if (i + len > bytes.length) break;
    if (len === 2) handleMidiMessage(status, bytes[i], bytes[i + 1], 'ble');
    i += len;
    if (len === 0) status = 0;
  }
}

async function bleAttach(device: BluetoothDevice) {
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(BLE_MIDI_SERVICE);
  const ch = await service.getCharacteristic(BLE_MIDI_CHAR);
  ch.addEventListener('characteristicvaluechanged', e => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (v) parseBlePacket(v);
  });
  await ch.startNotifications();
  setState('ble', { status: 'on', label: device.name ?? undefined });
}

export async function connectBle() {
  if (!support.bluetooth) {
    setState('ble', {
      status: 'error',
      error: support.isIOS ? 'in.iosBle' : 'in.noBle',
    });
    return;
  }
  setState('ble', { status: 'connecting' });
  try {
    bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_MIDI_SERVICE] }] });
    bleDevice.addEventListener('gattserverdisconnected', async () => {
      setState('ble', { status: 'connecting', label: bleDevice?.name ?? undefined });
      for (let attempt = 0; attempt < 3 && bleDevice; attempt++) {
        try { await bleAttach(bleDevice); return; } catch { await new Promise(r => setTimeout(r, 1500)); }
      }
      setState('ble', { status: 'error', error: 'in.bleDropped' });
    });
    await bleAttach(bleDevice);
  } catch (err) {
    const msg = err instanceof Error && err.name === 'NotFoundError'
      ? 'in.bleNotChosen'
      : 'in.bleFailed';
    setState('ble', { status: 'error', error: msg });
  }
}

export function disconnectBle() {
  const d = bleDevice;
  bleDevice = null;
  d?.gatt?.disconnect();
  setState('ble', { status: 'off' });
}

// ---------------- Microphone pitch detection ----------------
let micStream: MediaStream | null = null;
let micTimer = 0;
/** Pitch classes the app itself just played, so the mic does not "hear" the accompaniment as Hugo. */
const appPlayed = new Map<number, number>();
export function markAppPlayed(midi: number) { appPlayed.set(midi % 12, performance.now()); }
let expectedPcs = new Set<number>();
export function setExpected(midis: number[]) { expectedPcs = new Set(midis.map(m => m % 12)); }

export async function connectMic() {
  if (!support.mic) {
    setState('mic', { status: 'error', error: 'in.noMic' });
    return;
  }
  setState('mic', { status: 'connecting' });
  setAudioSession('play-and-record');
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    setAudioSession('playback');
    setState('mic', { status: 'error', error: 'in.micBlocked' });
    return;
  }
  const ctx = audioContext();
  await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(micStream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -45;

  let current: number | null = null;
  let candidate = -1, stable = 0, quiet = 0, noise = 0.004, lastRms = 0, armed = true;

  const step = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    noise = rms < noise * 2 ? noise * 0.97 + rms * 0.03 : noise * 0.999 + rms * 0.001;
    const threshold = Math.max(0.008, noise * 3);
    const rising = rms > lastRms * 1.35 && rms > threshold;
    lastRms = rms;

    const [freq, clarity] = detector.findPitch(buf, ctx.sampleRate);
    if (rms > threshold && clarity > 0.86 && freq > 26 && freq < 4300) {
      quiet = 0;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      if (midi === candidate) stable++; else { candidate = midi; stable = 1; }
      if (rising) armed = true;
      if (stable >= 2 && (midi !== current || armed)) {
        const pc = midi % 12;
        const echo = (appPlayed.get(pc) ?? 0) > performance.now() - 450 && !expectedPcs.has(pc);
        if (!echo) {
          if (current !== null) emit({ type: 'off', midi: current, velocity: 0, source: 'mic' });
          emit({ type: 'on', midi, velocity: Math.min(127, 40 + rms * 900), source: 'mic' });
          current = midi;
        }
        armed = false;
      }
    } else {
      stable = 0;
      if (++quiet > 3 && current !== null) {
        emit({ type: 'off', midi: current, velocity: 0, source: 'mic' });
        current = null;
      }
      if (quiet > 1) armed = true;
    }
  };
  window.clearInterval(micTimer);
  micTimer = window.setInterval(step, 23);
  setState('mic', { status: 'on' });
}

export function disconnectMic() {
  window.clearInterval(micTimer);
  micStream?.getTracks().forEach(t => t.stop());
  micStream = null;
  setAudioSession('playback');
  setState('mic', { status: 'off' });
}

export async function connect(kind: Source) {
  if (kind === 'mic') return connectMic();
  if (kind === 'ble') return connectBle();
  return connectWebMidi();
}

// Dev-only hook so the flow can be exercised without a keyboard.
if (import.meta.env.DEV) {
  (window as unknown as { __hpNote: (midi: number, on?: boolean) => void }).__hpNote = (midi, on = true) =>
    emit({ type: on ? 'on' : 'off', midi, velocity: 90, source: 'midi' });
}
