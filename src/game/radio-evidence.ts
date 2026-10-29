/** Original, deterministic calibration audio. No recordings, speech services or microphone input. */
export type RadioProfile='normal'|'echo'|'chop'|'static'|'detune'|'wrong_channel'|'aftertone'|'no_squelch'|'countercode'|'left_only'|'wrong_room'|'order_swap'|'pulse_inside';
export type RadioEvidenceContext={relayCode?:string};
export type RadioProbeEvidence={
  referenceCode:string;receivedCode:string;sequence:number[];
  /** Fractions of generated signal power, before the optional accessibility downmix. */
  channels:{left:number;right:number};reverbSeconds:number;closingClick:boolean;pulseCount:number;
};
export type ProbeTone={at:number;frequency:number;frequency2?:number;duration:number;gain:number;kind:'sequence'|'code'|'aftertone';step?:number;digit?:string};
export type ProbePattern={tones:ProbeTone[];noise:boolean;modulated:boolean;caption:string;duration:number;evidence:RadioProbeEvidence;openingAt:number;closingAt:number;breathAt:number|null};
export type ProbePcm={channels:[Float32Array,Float32Array];sampleRate:number;duration:number;caption:string;evidence:RadioProbeEvidence};

const profiles:Record<string,RadioProfile>={
  radio_echo:'echo',radio_chop:'chop',radio_static:'static',radio_detune:'detune',radio_wrong_channel:'wrong_channel',radio_aftertone:'aftertone',
  radio_no_squelch:'no_squelch',radio_countercode:'countercode',radio_left_only:'left_only',radio_wrong_room:'wrong_room',radio_order_swap:'order_swap',radio_pulse_inside:'pulse_inside',
};
const DTMF:Record<string,[number,number]>={
  '1':[697,1209],'2':[697,1336],'3':[697,1477],'4':[770,1209],'5':[770,1336],
  '6':[770,1477],'7':[852,1209],'8':[852,1336],'9':[852,1477],'0':[941,1336],
};
export const RADIO_NORMAL_REVERB_SECONDS=0.12;
export const RADIO_LONG_REVERB_SECONDS=2.4;
export function profileForEffects(effects:string[]):RadioProfile{return effects.map(id=>profiles[id]).find(Boolean)??'normal';}
export function normalizeRadioEvidence(context:RadioEvidenceContext={}):Required<RadioEvidenceContext>{
  return {relayCode:typeof context.relayCode==='string'&&/^\d{4}$/.test(context.relayCode)?context.relayCode:'3142'};
}
function counterCode(code:string):string{
  // Always differs, including repeated digits and wraparound; the displayed reference is never changed.
  return `${code.slice(0,3)}${(Number(code[3])+1)%10}`;
}
export function getRadioReferenceCaption(context:RadioEvidenceContext={}):string{
  const {relayCode}=normalizeRadioEvidence(context);
  return `Contrôle normal : clic d’ouverture · code RELAIS ${relayCode.split('').join(' · ')} en tonalités DTMF · séquence 1 · 2 · 3 · clic de fermeture. Signal centré G 50 % / D 50 % ; réverbération 0,12 s, puis silence.`;
}
export const radioReferenceCaption=getRadioReferenceCaption();

export function getProbePattern(profile:RadioProfile,context:RadioEvidenceContext={}):ProbePattern{
  const referenceCode=normalizeRadioEvidence(context).relayCode;
  const receivedCode=profile==='countercode'?counterCode(referenceCode):referenceCode;
  const sequence=profile==='wrong_channel'?[9,9,0]:profile==='order_swap'?[1,3,2]:[1,2,3];
  const frequencies:Record<number,number>={0:330,1:660,2:880,3:1100,9:1320};
  const tones:ProbeTone[]=sequence.map((step,i)=>({at:2+i*0.55,frequency:frequencies[step],duration:0.18,gain:profile==='chop'&&i===1?0:0.055,kind:'sequence',step}));
  if(profile==='echo')tones.push(...tones.map(t=>({...t,at:t.at+0.25,gain:t.gain*0.5})));
  for(const [index,digit] of [...receivedCode].entries()){
    const [frequency,frequency2]=DTMF[digit];
    tones.push({at:0.18+index*0.37,frequency,frequency2,duration:0.18,gain:0.04,kind:'code',digit});
  }
  if(profile==='aftertone')tones.push({at:4.1,frequency:165,duration:0.7,gain:0.045,kind:'aftertone'});
  const audibleSequence=tones.filter(t=>t.kind==='sequence'&&t.gain>0).sort((a,b)=>a.at-b.at).map(t=>t.step!);
  if(profile==='pulse_inside')audibleSequence.push(4);
  const evidence:RadioProbeEvidence={referenceCode,receivedCode,sequence:audibleSequence,channels:profile==='left_only'?{left:1,right:0}:{left:0.5,right:0.5},reverbSeconds:profile==='wrong_room'?RADIO_LONG_REVERB_SECONDS:RADIO_NORMAL_REVERB_SECONDS,closingClick:profile!=='no_squelch',pulseCount:audibleSequence.length};
  const details:Record<RadioProfile,string>={
    normal:'Trois tonalités nettes, puis silence.',
    echo:'Séquence 1 · 1 · 2 · 2 · 3 · 3 : chaque tonalité revient en écho.',
    chop:'Séquence 1 · [coupure] · 3 : la deuxième tonalité manque.',
    static:'[Grésillement] sur le code et les trois tonalités.',
    detune:'Modulation métallique sur les trois tonalités.',
    wrong_channel:'Séquence 9 · 9 · 0 au lieu de 1 · 2 · 3.',
    aftertone:'Une porteuse basse revient après le clic final et un silence.',
    no_squelch:'Le clic d’ouverture est présent, le clic de fermeture manque. Fin de séquence confirmée ; ce clic absent ne maintient pas la transmission.',
    countercode:`Le test retourne ${receivedCode}, différent du code RELAIS de référence ${referenceCode}. Les chiffres sont encodés en DTMF, sans voix parlée.`,
    left_only:'Routage du signal généré : gauche 100 % / droite 0 %, au lieu du centre. Ce relevé ne mesure pas votre casque.',
    wrong_room:'La réverbération synthétique dure 2,40 s au lieu de 0,12 s et persiste après la fermeture.',
    order_swap:'Séquence 1 · 3 · 2 : trois tonalités claires, deuxième et troisième inversées.',
    pulse_inside:'Après les trois tonalités et le clic final : quatrième impulsion lente, avec souffle synthétique. Aucun enregistrement de respiration.',
  };
  const caption=profile==='normal'?getRadioReferenceCaption(context):`Contrôle reçu : code DTMF ${receivedCode.split('').join(' · ')} ; référence RELAIS ${referenceCode}. ${details[profile]} ${profile==='left_only'?'':'Signal centré G 50 % / D 50 %. '}${evidence.closingClick?'Clic final présent.':'Clic final absent.'}`;
  return {tones,noise:profile==='static',modulated:profile==='detune',caption,duration:profile==='wrong_room'?5.85:profile==='pulse_inside'?5.15:profile==='aftertone'?5.05:3.95,evidence,openingAt:0.015,closingAt:3.64,breathAt:profile==='pulse_inside'?4.05:null};
}

function checkedRate(value:number):number{
  if(!Number.isFinite(value)||value<8000||value>192000)throw new RangeError('Fréquence audio hors limites.');
  return Math.round(value);
}
/** Four finite comb responses. The exact same response feeds the PCM test and WebAudio convolver. */
export function reverberateRadio(input:Float32Array,sampleRate:number,seconds:number):Float32Array{
  const rate=checkedRate(sampleRate);const duration=Math.max(0.01,Math.min(3,seconds));
  const lines=[0.0297,0.0371,0.0411,0.0437].map(delay=>{
    const distance=Math.round(delay*rate),count=Math.max(1,Math.floor(duration*rate/distance));
    const feedback=10**(-3*distance/(duration*rate));
    return {distance,count,feedback,tail:feedback**count};
  });
  const weight=1/lines.reduce((sum,line)=>sum+(1-line.tail)/(1-line.feedback),0);
  const output=new Float32Array(input.length);
  for(const line of lines){
    const state=new Float64Array(input.length);const end=(line.count+1)*line.distance;
    for(let i=line.distance;i<input.length;i++){
      const value=input[i-line.distance]+line.feedback*state[i-line.distance]-(i>=end?line.tail*input[i-end]:0);
      state[i]=value;output[i]+=value*weight;
    }
  }
  return output;
}
export function createRoomImpulse(sampleRate:number,seconds:number):Float32Array{
  const rate=checkedRate(sampleRate);const input=new Float32Array(Math.ceil(rate*Math.max(0.01,Math.min(3,seconds)))+1);input[0]=1;
  return reverberateRadio(input,rate,seconds);
}
function envelope(t:number,duration:number,attack=0.012,release=0.025):number{
  return Math.max(0,Math.min(1,t/attack,(duration-t)/release));
}
function noiseSeed(seed:number){let state=seed>>>0;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2147483648-1;};}
function addNoise(output:Float32Array,sampleRate:number,at:number,duration:number,gain:number,seed:number,breath=false):void{
  const random=noiseSeed(seed);const start=Math.round(at*sampleRate),end=Math.min(output.length,start+Math.ceil(duration*sampleRate));let low=0;
  for(let i=start;i<end;i++){
    const t=(i-start)/sampleRate;low+=0.16*(random()-low);
    const shape=breath?Math.sin(Math.PI*t/duration)**2:envelope(t,duration,0.002,Math.min(0.02,duration/2));
    output[i]+=gain*shape*(breath?low*1.8+Math.sin(2*Math.PI*78*t)*0.2:random());
  }
}

/** This is the actual waveform supplied to AudioBuffer, not a second test-only implementation. */
export function renderProbePcm(profile:RadioProfile,context:RadioEvidenceContext={},sampleRate=48000):ProbePcm{
  const rate=checkedRate(sampleRate);const pattern=getProbePattern(profile,context);const dry=new Float32Array(Math.ceil(pattern.duration*rate));
  for(const tone of pattern.tones){
    if(tone.gain===0)continue;
    const start=Math.round(tone.at*rate),end=Math.min(dry.length,start+Math.ceil(tone.duration*rate));
    for(let i=start;i<end;i++){
      const t=(i-start)/rate;const modulation=pattern.modulated&&tone.kind==='sequence'?1.8*Math.sin(2*Math.PI*32*t):0;
      const primary=Math.sin(2*Math.PI*tone.frequency*t+modulation);
      const value=tone.frequency2?(primary+Math.sin(2*Math.PI*tone.frequency2*t))*0.5:primary;
      dry[i]+=tone.gain*envelope(t,tone.duration)*value;
    }
  }
  if(pattern.noise)addNoise(dry,rate,0.12,3.3,0.018,0x1736a21);
  if(pattern.breathAt!==null)addNoise(dry,rate,pattern.breathAt,0.85,0.065,0x9a7c15,true);
  const reverb=reverberateRadio(dry,rate,pattern.evidence.reverbSeconds);
  const wetGain=profile==='wrong_room'?0.6:0.08;
  for(let i=0;i<dry.length;i++)dry[i]+=wetGain*reverb[i];
  // Boundary clicks do not enter the room response: absence of the final click stays unambiguous.
  addNoise(dry,rate,pattern.openingAt,0.035,0.035,0x531c);
  if(pattern.evidence.closingClick)addNoise(dry,rate,pattern.closingAt,0.045,0.035,0x672f);
  const left=new Float32Array(dry.length),right=new Float32Array(dry.length);
  const leftGain=Math.sqrt(pattern.evidence.channels.left),rightGain=Math.sqrt(pattern.evidence.channels.right);
  for(let i=0;i<dry.length;i++){const sample=Math.max(-0.18,Math.min(0.18,dry[i]));left[i]=sample*leftGain;right[i]=sample*rightGain;}
  return {channels:[left,right],sampleRate:rate,duration:dry.length/rate,caption:pattern.caption,evidence:pattern.evidence};
}

/** Small received-voice cue for the fourth synthetic breath; also used by the calibration renderer. */
export function renderBreathPcm(sampleRate=48000):Float32Array{
  const rate=checkedRate(sampleRate);const output=new Float32Array(Math.ceil(rate*1.05));
  addNoise(output,rate,0.1,0.85,0.05,0x9a7c15,true);return output;
}
