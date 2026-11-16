/** Opt-in local reference-only measurement. Histogram storage is bounded for 30 minute runs. */
export type FrameCounters={drawCalls:number;triangles:number;geometries:number;textures:number;width:number;height:number;quality:'low'|'medium'|'high'};
export type CaptureResult={schema:'parallaxe-performance-v1';status:string;frames:number;activeSeconds:number;excludedFrames:number;intervalMs:{mean:number;p50Upper:number;p95Upper:number;max:number};cpuSubmissionMs:{mean:number;p95Upper:number;max:number};render:{meanCalls:number;maxCalls:number;meanTriangles:number;maxGeometries:number;maxTextures:number};configuration:Pick<FrameCounters,'width'|'height'|'quality'>|null;limits:string[]};
const LIMITS=['Mesure locale du passage de référence solo, pas un benchmark GPU.','CPU = mise à jour de scène et soumission des commandes ; aucune attente de fin GPU.','Quantiles : borne supérieure par tranche de 1 ms.','Pauses, onglets masqués et changements de configuration exclus ; aucun identifiant, jeton, nom, graine ou indice privé exporté.'];
const round=(n:number)=>Number(n.toFixed(3));
export class PerformanceCapture{
 private interval=new Uint32Array(5002);private cpu=new Uint32Array(5002);
 private started=false;private last:number|null=null;private context='';private target=60;private status='idle';
 private count=0;private seconds=0;private excluded=0;private sumDt=0;private maxDt=0;private sumCpu=0;private maxCpu=0;
 private sumCalls=0;private maxCalls=0;private sumTriangles=0;private maxGeometries=0;private maxTextures=0;
 private config:CaptureResult['configuration']=null;
 start(seconds=60){this.interval.fill(0);this.cpu.fill(0);this.started=true;this.last=null;this.context='';this.target=[30,60,1800].includes(seconds)?seconds:60;this.status='recording';this.count=0;this.seconds=0;this.excluded=0;this.sumDt=0;this.maxDt=0;this.sumCpu=0;this.maxCpu=0;this.sumCalls=0;this.maxCalls=0;this.sumTriangles=0;this.maxGeometries=0;this.maxTextures=0;this.config=null;}
 get recording(){return this.started;}
 pause(){if(this.started){this.last=null;this.excluded++;}}
 stop(reason='stopped'){if(this.started){this.started=false;this.last=null;this.status=reason;}}
 sample(now:number,cpuMs:number,counters:FrameCounters,eligible:boolean,context:string){
  if(!this.started)return;
  if(!eligible||!Number.isFinite(now)||!Number.isFinite(cpuMs)||cpuMs<0){this.last=null;this.excluded++;return;}
  const numeric=[counters.drawCalls,counters.triangles,counters.geometries,counters.textures,counters.width,counters.height];
  if(numeric.some(v=>!Number.isFinite(v)||v<0)||!['low','medium','high'].includes(counters.quality)){this.last=null;this.excluded++;return;}
  const config={width:counters.width,height:counters.height,quality:counters.quality};
  if(this.config&&(this.context!==context||JSON.stringify(this.config)!==JSON.stringify(config))){this.stop('configuration-changed');return;}
  this.context=context;this.config=config;
  const previous=this.last;this.last=now;
  if(previous===null)return;
  const dt=now-previous;if(!Number.isFinite(dt)||dt<=0){this.last=null;this.excluded++;return;}
  // Do not discard large visible stalls: they matter to perceived performance.
  this.interval[Math.min(5001,Math.ceil(dt))]++;this.cpu[Math.min(5001,Math.ceil(cpuMs))]++;
  this.count++;this.sumDt+=dt;this.seconds=this.sumDt/1000;this.maxDt=Math.max(this.maxDt,dt);this.sumCpu+=cpuMs;this.maxCpu=Math.max(this.maxCpu,cpuMs);
  this.sumCalls+=counters.drawCalls;this.maxCalls=Math.max(this.maxCalls,counters.drawCalls);this.sumTriangles+=counters.triangles;this.maxGeometries=Math.max(this.maxGeometries,counters.geometries);this.maxTextures=Math.max(this.maxTextures,counters.textures);
  if(this.seconds>=this.target)this.stop('completed');
 }
 result():CaptureResult{
  const percentile=(hist:Uint32Array,p:number,max:number)=>{const required=Math.ceil(this.count*p);if(!required)return 0;let count=0;for(let i=0;i<hist.length;i++){count+=hist[i];if(count>=required)return i===5001?Math.ceil(max):i;}return 0;};
  return {schema:'parallaxe-performance-v1',status:this.status,frames:this.count,activeSeconds:round(this.seconds),excludedFrames:this.excluded,
   intervalMs:{mean:round(this.count?this.sumDt/this.count:0),p50Upper:percentile(this.interval,.50,this.maxDt),p95Upper:percentile(this.interval,.95,this.maxDt),max:round(this.maxDt)},
   cpuSubmissionMs:{mean:round(this.count?this.sumCpu/this.count:0),p95Upper:percentile(this.cpu,.95,this.maxCpu),max:round(this.maxCpu)},
   render:{meanCalls:round(this.count?this.sumCalls/this.count:0),maxCalls:this.maxCalls,meanTriangles:round(this.count?this.sumTriangles/this.count:0),maxGeometries:this.maxGeometries,maxTextures:this.maxTextures},configuration:this.config?{...this.config}:null,limits:[...LIMITS]};
 }
}
