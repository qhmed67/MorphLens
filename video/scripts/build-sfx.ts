/**
 * build-sfx.ts — synthesise the reel's motion sounds.
 *
 * The guide allows "clean simple non-musical effects" (whooshes, impacts, UI
 * clicks) as long as no music is used. Rather than ship stock files, every
 * sound here is generated from scratch with plain maths, so the reel carries
 * no third-party audio and nothing needs a licence.
 *
 * Run: npm run sfx   →   public/sfx/*.wav
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'sfx');
mkdirSync(out, { recursive: true });

const SR = 48000;

/**
 * Write 16-bit mono PCM.
 *
 * Every file is normalised to the same peak so the mix is predictable (the
 * per-use volume in the scenes then means the same thing for every sound),
 * and a silent file is a hard error — a NaN in the maths would otherwise
 * ship as a track of zeros.
 */
function writeWav(name: string, samples: Float32Array): void {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    if (!Number.isFinite(samples[i])) {
      throw new Error(`${name}: sample ${i} is not a finite number`);
    }
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak < 0.001) {
    throw new Error(`${name}: the sound is silent (peak ${peak})`);
  }
  const gain = 0.92 / peak;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;

  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(out, name), Buffer.concat([header, data]));
  console.log('wrote', name, `${(samples.length / SR).toFixed(2)}s`);
}

/** Deterministic white noise (no Math.random → the same file every build). */
let seed = 20261021;
function noise(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x3fffffff - 1) * 0.5;
}

/** One-pole low pass with a per-sample cutoff. */
function lowPass(input: Float32Array, cutoffs: number[]): Float32Array {
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i += 1) {
    const cutoff = cutoffs[Math.min(i, cutoffs.length - 1)];
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    y += a * (input[i] - y);
    out[i] = y;
  }
  return out;
}

/** Attack/decay envelope, in seconds. */
function envelope(t: number, attack: number, decay: number): number {
  if (t < attack) return t / attack;
  return Math.exp((-3 * (t - attack)) / decay);
}

/**
 * 1. Whoosh — filtered noise sweeping up and back down. Used when the photo
 *    changes or a scene hands over to the next.
 */
{
  const dur = 0.5;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    raw[i] = noise();
    // sweep 400 Hz → 6 kHz → 700 Hz
    cut[i] = t < 0.5 ? 400 + t * 11200 : 6000 - (t - 0.5) * 10600;
  }
  const filtered = lowPass(raw, Array.from(cut));
  const hp = new Float32Array(n);
  const slow = lowPass(raw, new Array(n).fill(400));
  for (let i = 0; i < n; i += 1) hp[i] = filtered[i] - slow[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    out[i] = hp[i] * 2.2 * envelope(t, 0.08, 0.16);
  }
  writeWav('whoosh.wav', out);
}

/**
 * 2. Pop — a short pitched blip with a click transient. Used when a window,
 *    a chip or a result lands.
 */
{
  const dur = 0.14;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const freq = 720 - t * 1800; // a tiny downward pitch drop
    const body = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(4 * Math.PI * freq * t) * 0.2;
    const transient = i < 90 ? noise() * (1 - i / 90) * 0.5 : 0;
    out[i] = (body + transient) * envelope(t, 0.002, 0.045);
  }
  writeWav('pop.wav', out);
}

/**
 * 3. Click — a tiny UI tick, used for chips, sliders and toggles.
 */
{
  const dur = 0.05;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i += 1) raw[i] = noise();
  const lp = lowPass(raw, new Array(n).fill(2600));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    out[i] = (lp[i] - raw[i] * 0.4) * 1.6 * envelope(t, 0.001, 0.012);
  }
  writeWav('click.wav', out);
}

/**
 * 4. Thump — a low impact for the moment a result lands.
 */
{
  const dur = 0.42;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i += 1) raw[i] = noise();
  const lp = lowPass(raw, new Array(n).fill(220));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const body = Math.sin(2 * Math.PI * (86 - t * 26) * t);
    out[i] = (body * 0.8 + lp[i] * 0.5) * envelope(t, 0.004, 0.11);
  }
  writeWav('thump.wav', out);
}

/**
 * 5. Tick — a very short high click, used while numbers type in.
 */
{
  const dur = 0.03;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * 2100 * t) + noise() * 0.4) * envelope(t, 0.0008, 0.006);
  }
  writeWav('tick.wav', out);
}

/**
 * 6. Sweep — a rising tone for a curve being drawn (the contrast transfer
 *    curve) and for a stage advancing.
 */
{
  const dur = 0.75;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    raw[i] = noise();
    cut[i] = 500 + t * 3500;
  }
  const filtered = lowPass(raw, Array.from(cut));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const tone = Math.sin(2 * Math.PI * (240 + t * 900) * t) * 0.35;
    out[i] = (filtered[i] * 1.6 + tone) * envelope(t, 0.12, 0.3);
  }
  writeWav('sweep.wav', out);
}

/**
 * 7. Ratchet — a soft, repeating tick used while the pixel values type in.
 */
{
  const dur = 0.09;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * 1500 * t) + noise() * 0.3) * envelope(t, 0.001, 0.018);
  }
  writeWav('ratchet.wav', out);
}

/**
 * 8. Zoom-in — a rising whoosh that tracks a camera push. The pitch and the
 *    noise band climb together, so it reads as moving *closer*.
 */
{
  const dur = 2.6;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    raw[i] = noise();
    cut[i] = 300 + t * 5200;
  }
  const filtered = lowPass(raw, Array.from(cut));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const p = t / dur;
    // A rising tone bed: 120 Hz → 900 Hz.
    const tone = Math.sin(2 * Math.PI * (120 + p * 780) * t) * 0.3;
    out[i] = (filtered[i] * 1.5 + tone) * envelope(t, 0.2, 1.1);
  }
  writeWav('zoomin.wav', out);
}

/**
 * 9. Zoom-out — the same idea in reverse, falling and opening up.
 */
{
  const dur = 2.8;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    raw[i] = noise();
    cut[i] = 5200 - t * 4600;
  }
  const filtered = lowPass(raw, Array.from(cut));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const p = t / dur;
    const tone = Math.sin(2 * Math.PI * (900 - p * 740) * t) * 0.28;
    out[i] = (filtered[i] * 1.5 + tone) * envelope(t, 0.06, 1.3);
  }
  writeWav('zoomout.wav', out);
}

/**
 * 10. Dolly — a very soft, low bed for a long camera move; it sits under the
 *     picture instead of punctuating it.
 */
{
  const dur = 2.0;
  const n = Math.floor(SR * dur);
  const raw = new Float32Array(n);
  const cut = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / n;
    raw[i] = noise();
    cut[i] = 160 + t * 260;
  }
  const filtered = lowPass(raw, Array.from(cut));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    out[i] = filtered[i] * 2.4 * envelope(t, 0.5, 1.1);
  }
  writeWav('dolly.wav', out);
}
