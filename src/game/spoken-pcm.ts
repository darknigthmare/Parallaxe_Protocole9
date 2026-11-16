import { SPOKEN_BANK, SPOKEN_RATE } from './spoken-bank';
/** Offline, deterministic authored voice. Never browser/cloud TTS or microphone capture. */
export function spokenPCM(token:string, sampleRate:number):Float32Array {
  const entry=Object.hasOwn(SPOKEN_BANK,token)?SPOKEN_BANK[token]:undefined;
  if(!entry||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('Unsupported voice token/sample rate');
  const bytes=atob(entry.data),out=new Float32Array(Math.ceil(bytes.length*sampleRate/SPOKEN_RATE));
  const decode=(i:number)=>{const y=bytes.charCodeAt(Math.min(bytes.length-1,i))/127.5-1;return Math.sign(y)*Math.expm1(Math.abs(y)*Math.log(256))/255;};
  for(let i=0;i<out.length;i++){
    const x=i*SPOKEN_RATE/sampleRate,lo=Math.floor(x),f=x-lo;
    const value=decode(lo)*(1-f)+decode(lo+1)*f;
    out[i]=Math.max(-.72,Math.min(.72,value))*Math.min(1,i/(sampleRate*.008),(out.length-1-i)/(sampleRate*.012));
  }
  return out;
}
