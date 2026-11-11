import type { AcousticKind } from './acoustic-state';
/** Original deterministic, bounded mono cues. This module has no browser/microphone API. */
export function acousticPCM(kind: AcousticKind, sampleRate: number): Float32Array {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Invalid sample rate');
  const seconds = kind === 'rain' ? 4 : kind === 'held-note' ? 2 : kind.startsWith('knock') ? 12 : 8;
  const out = new Float32Array(seconds * sampleRate);
  const notes = [261.625565, 329.627557, 391.995436, 293.664768, 349.228231, 440, 391.995436, 523.251131];
  let seed = 91357, low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low = low * .91 + noise * .09;
    let value = 0;
    if (kind === 'rain') value = (low * .7 + noise * .09) * .32 * Math.min(1, t * 50, (seconds - t) * 50);
    else if (kind === 'breath') {
      const envelope = t < 3.2 ? Math.sin(Math.PI * t / 3.2) : t < 3.8 ? 0 : Math.sin(Math.PI * (t - 3.8) / 4.2) * .72;
      value = low * Math.max(0, envelope) * .50;
    } else if (kind.startsWith('knock')) {
      for (let n = 0; n < (kind === 'knock3' ? 3 : 4); n++) {
        const age = t - 1 - n * .7;
        if (age >= 0 && age < .15) value += (Math.sin(age * 2 * Math.PI * 118) * .33 + low * .2) * Math.exp(-age * 37) * Math.min(1, age * 1000);
      }
    } else {
      const held = kind === 'held-note' || kind === 'melody-held' && t >= 5.6;
      if (held) {
        // 1047 complete cycles in the two-second loop avoid a click at its seam.
        const f = 523.5, phase = kind === 'held-note' ? t : t - 5.6;
        value = (Math.sin(2 * Math.PI * f * phase) + .2 * Math.sin(4 * Math.PI * f * phase)) * .09;
        if (kind !== 'held-note') value *= Math.min(1, (t - 5.6) * 30);
      } else {
        const n = Math.floor(t / .7), age = t % .7;
        if (n < 8) value = (Math.sin(2 * Math.PI * notes[n] * age) + .22 * Math.sin(6 * Math.PI * notes[n] * age))
          * .15 * Math.exp(-age * 6) * Math.min(1, age * 140) * Math.min(1, (.7 - age) * 80);
      }
    }
    out[i] = Math.max(-.45, Math.min(.45, value));
  }
  return out;
}
