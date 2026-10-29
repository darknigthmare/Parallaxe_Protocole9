import type { LevelId } from './levels';

/** Original synthesized ambience. No recordings or external audio dependencies. */
export class Atmosphere {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: GainNode | null = null;
  private volume = 0.38;
  private lastStep = 0;
  private enabled = true;
  private location: LevelId = 'hotel';
  private oscillators: OscillatorNode[] = [];
  private airFilter: BiquadFilterNode | null = null;
  private profiles = {
    hotel: { frequencies: [47, 94.07, 141.03], air: 290, step: [65, 28, .09, .10] },
    metro: { frequencies: [41.2, 82.45, 247.15], air: 720, step: [112, 44, .12, .085] },
    clinic: { frequencies: [52, 104.03, 208.05], air: 440, step: [88, 36, .075, .075] },
    cabin: { frequencies: [36.7, 73.45, 146.83], air: 185, step: [79, 31, .13, .085] },
  };

  async start() {
    if (!this.context) {
      const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (!Ctx) return;
      const c = this.context = new Ctx();
      const out = this.master = c.createGain();
      out.gain.value = this.enabled ? this.volume : 0;
      out.connect(c.destination);
      const ambient = this.drone = c.createGain();
      ambient.gain.value = 0.06;
      ambient.connect(out);
      this.profiles[this.location].frequencies.forEach((frequency, i) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = frequency;
        gain.gain.value = 0.2 / (i + 1);
        osc.connect(gain).connect(ambient);
        osc.start();
        this.oscillators.push(osc);
      });
      const length = c.sampleRate * 4;
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i=0;i<length;i++) { last = (last + Math.random()*0.02-0.01) * 0.985; data[i] = last; }
      const noise = c.createBufferSource(); noise.buffer=buffer; noise.loop=true;
      const filter=this.airFilter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=this.profiles[this.location].air;
      const g=c.createGain();g.gain.value=0.8;
      noise.connect(filter).connect(g).connect(ambient);noise.start();
    }
    if(this.context.state==='suspended') await this.context.resume().catch(()=>{});
  }
  setVolume(v:number) {
    this.volume=Math.max(0,Math.min(1,v));
    if(this.master&&this.context)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,0.15);
  }
  setEnabled(enabled:boolean){this.enabled=enabled;this.setVolume(this.volume);}
  setLocation(location:LevelId) {
    this.location=location;
    const c=this.context;if(!c)return;
    const profile=this.profiles[location];
    this.oscillators.forEach((osc,index)=>osc.frequency.setTargetAtTime(profile.frequencies[index],c.currentTime,.8));
    this.airFilter?.frequency.setTargetAtTime(profile.air,c.currentTime,.8);
  }
  tension(level:number){if(this.drone&&this.context)this.drone.gain.setTargetAtTime(0.05+Math.min(1,level)*0.05,this.context.currentTime,2);}
  tone(kind:'signal'|'good'|'bad'|'click'|'step') {
    const c=this.context;if(!c||!this.master)return;
    if(kind==='step'&&c.currentTime-this.lastStep<0.43)return;
    if(kind==='step')this.lastStep=c.currentTime;
    const g=c.createGain();const o=c.createOscillator();
    const t=c.currentTime;
    const values={signal:[660,440,0.18,0.14],good:[390,780,0.6,0.12],bad:[120,42,1.1,0.16],click:[860,680,0.06,0.04],step:this.profiles[this.location].step}[kind];
    o.type=kind==='bad'?'triangle':'sine';
    o.frequency.setValueAtTime(values[0],t);o.frequency.exponentialRampToValueAtTime(values[1],t+values[2]);
    g.gain.setValueAtTime(0.001,t);g.gain.exponentialRampToValueAtTime(values[3],t+0.012);g.gain.exponentialRampToValueAtTime(0.001,t+values[2]);
    o.connect(g).connect(this.master);o.start();o.stop(t+values[2]+0.05);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  dispose(){this.context?.close().catch(()=>{});this.context=null;this.oscillators=[];this.airFilter=null;}
}
