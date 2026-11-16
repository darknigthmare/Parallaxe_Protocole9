import { acousticPCM } from './acoustic-pcm';
import type { AcousticFrame, AcousticKind, AcousticPose } from './acoustic-state';
/** Reuses the ambience bus. No capture, speech synthesis, network or wall-clock timers. */
export class AcousticAudio {
  private voices = new Map<string, { source: AudioBufferSourceNode; gain: GainNode; panner: PannerNode; kind: AcousticKind; key: string; timeOrigin: number }>();
  private buffers = new Map<AcousticKind, AudioBuffer>();
  private disposed = false;
  constructor(private context: AudioContext, private output: AudioNode) {}
  private buffer(kind: AcousticKind) {
    let buffer = this.buffers.get(kind);
    if (!buffer) {
      const pcm = acousticPCM(kind, this.context.sampleRate);
      buffer = this.context.createBuffer(1, pcm.length, this.context.sampleRate);
      buffer.getChannelData(0).set(pcm); this.buffers.set(kind, buffer);
    }
    return buffer;
  }
  private stopVoice(id: string) {
    const voice = this.voices.get(id); if (!voice) return;
    this.voices.delete(id); voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already ended. */ }
    voice.source.disconnect(); voice.gain.disconnect(); voice.panner.disconnect();
  }
  stop() { for (const id of [...this.voices.keys()]) this.stopVoice(id); }
  sync(frame: AcousticFrame, pose: AcousticPose, enabled: boolean) {
    if (this.disposed) return;
    if (!enabled || !frame.active || this.context.state !== 'running') { this.stop(); return; }
    const c = this.context, t = c.currentTime;
    const listener = c.listener;
    const x = Number.isFinite(pose.x) ? pose.x : 0, y = Number.isFinite(pose.y) ? pose.y! : 1.67, z = Number.isFinite(pose.z) ? pose.z : 9;
    const yaw = Number.isFinite(pose.yaw) ? pose.yaw! : 0, pitch = Number.isFinite(pose.pitch) ? pose.pitch! : 0;
    const forward = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const up = [Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
    if (listener.positionX) {
      [listener.positionX, listener.positionY, listener.positionZ].forEach((param, i) => param.setValueAtTime([x, y, z][i], t));
      [listener.forwardX, listener.forwardY, listener.forwardZ].forEach((param, i) => param.setValueAtTime(forward[i], t));
      [listener.upX, listener.upY, listener.upZ].forEach((param, i) => param.setValueAtTime(up[i], t));
    } else { listener.setPosition(x, y, z); listener.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]); }
    const wanted = new Set(frame.voices.map(v => v.id));
    for (const id of [...this.voices.keys()]) if (!wanted.has(id)) this.stopVoice(id);
    for (const spec of frame.voices) {
      let voice = this.voices.get(spec.id);
      const buffer = this.buffer(spec.kind);
      if(!Number.isFinite(spec.offset)||spec.offset<0||!spec.loop&&spec.offset>=buffer.duration){this.stopVoice(spec.id);continue;}
      const offset = spec.loop?spec.offset % buffer.duration:spec.offset;
      // Restart on replay/solo mask/reset, not on every animation frame. Allow normal loop wrap.
      const expected = voice ? (t - voice.timeOrigin) % buffer.duration : offset;
      const drift = Math.min(Math.abs(expected - offset), buffer.duration - Math.abs(expected - offset));
      if (voice && (voice.kind !== spec.kind || voice.key !== frame.key || drift > .20)) { this.stopVoice(spec.id); voice = undefined; }
      if (!voice) {
        const source = c.createBufferSource(), gain = c.createGain(), panner = c.createPanner();
        source.buffer = buffer; source.loop = spec.loop;
        panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2; panner.rolloffFactor = .8; panner.maxDistance = 32;
        source.connect(gain).connect(panner).connect(this.output);
        voice = { source, gain, panner, kind: spec.kind, key: frame.key, timeOrigin: t - offset };
        this.voices.set(spec.id, voice);
        const owned = voice;
        source.onended = () => { if (this.voices.get(spec.id) === owned) this.stopVoice(spec.id); };
        source.start(t, offset);
      }
      voice.gain.gain.setValueAtTime(Math.min(.7, Math.max(0, spec.gain)), t);
      if (voice.panner.positionX) [voice.panner.positionX, voice.panner.positionY, voice.panner.positionZ].forEach((p, i) => p.setValueAtTime(spec.position[i], t));
      else voice.panner.setPosition(...spec.position);
    }
  }
  dispose() { if (this.disposed) return; this.stop(); this.buffers.clear(); this.disposed = true; }
}
