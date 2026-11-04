import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { setAudioSession } from './audio';
import { NoteListener } from './pitch';

export type Source = 'midi' | 'ble' | 'mic';
export interface NoteEvent {
  type: 'on' | 'off';
  midi: number;
  velocity: number;
  source: Source;
  /** Microphone: when the key was actually struck (performance.now()), before detection delay. */
  at?: number;
  /** Microphone: every note heard in the same strike. */
  chord?: number[];
}
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

/** Running inside the iPhone app (Capacitor): MIDI comes from CoreMIDI, not the browser. */
export const isNative = Capacitor.isNativePlatform();

export interface NativeMidiStatus { devices: string[]; client: number; port: number; events: number; appVersion?: string; appBuild?: number; }
interface NativeMidiPlugin {
  start(): Promise<NativeMidiStatus>;
  status(): Promise<NativeMidiStatus>;
  showBluetooth(): Promise<void>;
  addListener(event: 'note', cb: (e: { type: 'on' | 'off'; midi: number; velocity: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'devices', cb: (e: { devices: string[] }) => void): Promise<PluginListenerHandle>;
}
const NativeMidi = registerPlugin<NativeMidiPlugin>('Midi');

export const support = {
  webMidi: isNative || (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator),
  bluetooth: isNative || (typeof navigator !== 'undefined' && 'bluetooth' in navigator),
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

let nativeStarted = false;
/** CoreMIDI sources the app is reading (for the input check). */
export let nativeMidiDevices: string[] = [];
function nativeDevices(devices: string[], quiet: boolean) {
  nativeMidiDevices = devices;
  const real = devices.filter(n => !/network|session/i.test(n));
  if (real.length) setState('midi', { status: 'on', label: real[0] });
  else setState('midi', quiet ? { status: 'off' } : { status: 'error', error: 'in.noMidiDevice' });
}
async function connectNativeMidi(quiet: boolean) {
  try {
    if (!nativeStarted) {
      nativeStarted = true;
      await NativeMidi.addListener('note', e => emit({ type: e.type, midi: e.midi, velocity: e.velocity, source: 'midi' }));
      await NativeMidi.addListener('devices', e => nativeDevices(e.devices, true));
    }
    const st = await NativeMidi.start();
    console.info('[midi] native start', JSON.stringify(st));
    nativeDevices(st.devices, quiet);
  } catch (err) {
    nativeStarted = false;
    console.error('[midi] native start failed', err);
    setState('midi', quiet ? { status: 'off' } : { status: 'error', error: 'in.nativeFailed' });
  }
}

export async function nativeMidiStatus(): Promise<NativeMidiStatus | null> {
  if (!isNative) return null;
  try { return await NativeMidi.status(); } catch { return null; }
}

/** `quiet`: no error when nothing is plugged in yet; plugging a keyboard in later still connects it. */
export async function connectWebMidi(quiet = false) {
  if (isNative) return connectNativeMidi(quiet);
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
  if (isNative) { connectNativeMidi(true); return; }
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
  if (isNative) {
    // iOS pairs Bluetooth MIDI in a system sheet; the keyboard then arrives as a MIDI source.
    await connectNativeMidi(true);
    try {
      await NativeMidi.showBluetooth();
      setState('ble', { status: 'off', label: undefined });
    } catch (err) {
      console.error('[midi] bluetooth sheet failed', err);
      setState('ble', { status: 'error', error: 'in.nativeFailed' });
    }
    return;
  }
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

// ---------------- Microphone note detection ----------------
let micStream: MediaStream | null = null;
let micCtx: AudioContext | null = null;
let micTimer = 0;
/** Pitch classes the app itself just played, so the mic does not "hear" the accompaniment as Hugo. */
const appPlayed = new Map<number, number>();
export function markAppPlayed(midi: number) { appPlayed.set(midi % 12, performance.now()); }
let expected: number[] = [];
/** Notes the song wants next: the detector checks these on weaker evidence. */
export function setExpected(midis: number[]) { expected = midis; }
let micRange: [number, number] = [33, 100];
/** Limit what the mic listens for to the song's range (fewer false notes). */
export function setMicRange(lo: number, hi: number) { micRange = [Math.max(21, lo - 5), Math.min(108, hi + 5)]; }

/** Live level (0..1) and the last strike, for the input check. */
export const micMeter = { level: 0, notes: [] as number[], at: 0 };

export async function connectMic() {
  if (!support.mic) {
    setState('mic', { status: 'error', error: 'in.noMic' });
    return;
  }
  setState('mic', { status: 'connecting' });
  setAudioSession('play-and-record');
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (err) {
    console.error('[mic] getUserMedia failed', err);
    setAudioSession('playback');
    setState('mic', { status: 'error', error: 'in.micBlocked' });
    return;
  }
  // A context of its own, made after capture started: on iOS a context created earlier can
  // run at the old sample rate and hear only silence.
  micCtx?.close().catch(() => {});
  const ctx = new AudioContext();
  micCtx = ctx;
  await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(micStream);
  const listener = new NoteListener(ctx.sampleRate);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = listener.size;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  console.info('[mic] listening at', ctx.sampleRate, 'Hz, window', listener.size);

  let sounding: number[] = [];
  let offTimer = 0;
  let silentSince = performance.now();
  const release = () => {
    sounding.forEach(m => emit({ type: 'off', midi: m, velocity: 0, source: 'mic' }));
    sounding = [];
  };

  const step = () => {
    if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return; }
    analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = buf.length - 1024; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    micMeter.level = Math.min(1, Math.sqrt(peak) * 1.4);
    const now = performance.now();
    // A capture that delivers only digital zeros is broken (another app holds the mic, or iOS
    // interrupted the session): say so instead of silently hearing nothing.
    if (peak > 1e-6) {
      silentSince = now;
      if (state.mic.status === 'error') setState('mic', { status: 'on' });
    } else if (now - silentSince > 3000 && state.mic.status === 'on') {
      setState('mic', { status: 'error', error: 'in.micSilent' });
    }

    listener.range = micRange;
    const strike = listener.process(buf, now, expected);
    if (!strike || !strike.notes.length) return;
    const notes = strike.notes.filter(m => {
      const echo = (appPlayed.get(m % 12) ?? 0) > strike.at - 500;
      return !echo || expected.some(e => e % 12 === m % 12);
    });
    if (!notes.length) return;
    micMeter.notes = notes;
    micMeter.at = now;
    release();
    const velocity = Math.round(Math.min(127, 45 + micMeter.level * 80));
    for (const m of notes) emit({ type: 'on', midi: m, velocity, source: 'mic', at: strike.at, chord: notes });
    sounding = notes;
    window.clearTimeout(offTimer);
    offTimer = window.setTimeout(release, 320);
  };
  window.clearInterval(micTimer);
  micTimer = window.setInterval(step, 12);
  setState('mic', { status: 'on' });
}

export function disconnectMic() {
  window.clearInterval(micTimer);
  micStream?.getTracks().forEach(t => t.stop());
  micStream = null;
  micCtx?.close().catch(() => {});
  micCtx = null;
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

// In development: a pretend piano for tests (window.__piano.connect(), window.__piano.note(64)).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __piano: unknown }).__piano = {
    connect: () => setState('midi', { status: 'on', name: 'Test piano' } as LinkState),
    note: (midi: number) => { emit({ type: 'on', midi, velocity: 80, source: 'midi' } as NoteEvent); window.setTimeout(() => emit({ type: 'off', midi, velocity: 0, source: 'midi' } as NoteEvent), 300); },
  };
}
