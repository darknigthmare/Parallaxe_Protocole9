import type {RadioSignal} from './session';

export type RadioProfile='normal'|'echo'|'chop'|'static'|'detune'|'wrong_channel'|'aftertone';
export type RadioStatus={enabled:boolean;microphone:boolean;talking:boolean;secure:boolean;supported:boolean;micLevel:number;error:string|null;caption:string;peers:{id:string;state:string;talking:boolean;signalingState:string;iceGatheringState:string;iceConnectionState:string;localDescription:boolean;remoteDescription:boolean;localCandidateCount:number;remoteCandidateCount:number}[]};
export type RadioPeer={id:string;connected:boolean;radioEnabled?:boolean;radioEpoch?:string;talking?:boolean};
export type RadioFrame={players:RadioPeer[];radioInbox?:RadioSignal[];serverTime?:number};
export type RadioOptions={selfId:string;send:(action:string,payload:Record<string,unknown>)=>Promise<unknown>;onState:(state:RadioStatus)=>void;iceServers?:RTCIceServer[]};
export const radioReferenceCaption='Contrôle normal : 1 · 2 · 3. Trois tonalités nettes, puis silence.';
const profiles:Record<string,RadioProfile>={radio_echo:'echo',radio_chop:'chop',radio_static:'static',radio_detune:'detune',radio_wrong_channel:'wrong_channel',radio_aftertone:'aftertone'};
export function profileForEffects(effects:string[]):RadioProfile{return effects.map(id=>profiles[id]).find(Boolean)??'normal';}
export function isPolitePeer(selfId:string,otherId:string):boolean{return selfId>otherId;}
export function getProbePattern(profile:RadioProfile){
  const frequencies=profile==='wrong_channel'?[1320,1320,330]:[660,880,1100];
  const tones=frequencies.map((frequency,i)=>({at:0.18+i*0.55,frequency,duration:0.18,gain:profile==='chop'&&i===1?0:0.055}));
  if(profile==='echo')tones.push(...tones.map(t=>({...t,at:t.at+0.25,gain:t.gain*0.5})));
  if(profile==='aftertone')tones.push({at:2.25,frequency:165,duration:0.7,gain:0.05});
  const captions:Record<RadioProfile,string>={normal:radioReferenceCaption,echo:'Contrôle reçu : 1 · 1 · 2 · 2 · 3 · 3. Chaque tonalité revient en écho.',chop:'Contrôle reçu : 1 · [coupure] · 3. La deuxième tonalité manque.',static:'Contrôle reçu : [grésillement] 1 · 2 · 3 [grésillement].',detune:'Contrôle reçu : 1 · 2 · 3, avec une modulation métallique sur les trois tonalités.',wrong_channel:'Contrôle reçu : 9 · 9 · 0. La séquence diffère de la référence 1 · 2 · 3.',aftertone:'Contrôle reçu : 1 · 2 · 3 · silence · [porteuse basse après la fin].'};
  return {tones,noise:profile==='static',modulated:profile==='detune',caption:captions[profile],duration:profile==='aftertone'?3.1:2.2};
}

type Receiver={source:MediaStreamAudioSourceNode;high:BiquadFilterNode;low:BiquadFilterNode;compressor:DynamicsCompressorNode;shape:WaveShaperNode;mod:GainNode;osc:OscillatorNode;depth:GainNode;gate:GainNode;dry:GainNode;delay:DelayNode;wet:GainNode;feedback:GainNode;noise:AudioBufferSourceNode;noiseGain:GainNode};
type Peer={id:string;epoch:string;pc:RTCPeerConnection;transceiver:RTCRtpTransceiver;makingOffer:boolean;ignoreOffer:boolean;settingAnswer:boolean;polite:boolean;candidates:(RTCIceCandidateInit|null)[];sending:Promise<void>;channel:RTCDataChannel|null;receiver:Receiver|null;talking:boolean;lastTalkData:number;restartCount:number;restartTimer:ReturnType<typeof setTimeout>|null;connectTimer:ReturnType<typeof setTimeout>|null;localCandidateCount:number;remoteCandidateCount:number};
const freshEpoch=()=>globalThis.crypto?.randomUUID?.()??`radio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

/** Audio stays peer-to-peer. Constructing/syncing this object never requests a microphone. */
export class RadioClient {
  private options:RadioOptions;
  private enabled=false;private microphone=false;private talking=false;private disposed=false;
  private epoch='';private joiningUntil=0;private error:string|null=null;private caption='';private micLevel=0;
  private clearedPreviousSession=false;
  private profile:RadioProfile='normal';private volume=0.7;
  private ctx:AudioContext|null=null;private master:GainNode|null=null;private noiseBuffer:AudioBuffer|null=null;
  private mic:MediaStream|null=null;private micSource:MediaStreamAudioSourceNode|null=null;private analyser:AnalyserNode|null=null;private silent:GainNode|null=null;
  private peers=new Map<string,Peer>();private frame:RadioFrame={players:[]};
  private seen=new Set<string>();private acknowledgements=new Set<string>();private receiving=Promise.resolve();private receiveScheduled=false;
  private statusSending:Promise<void>=Promise.resolve();
  private microphoneRequest:Promise<void>|null=null;
  private microphoneGeneration=0;private playbackGeneration=0;
  private meter:ReturnType<typeof setInterval>|null=null;private keepAlive:ReturnType<typeof setInterval>|null=null;private pttLimit:ReturnType<typeof setTimeout>|null=null;
  private stopOnBlur=()=>this.setTalking(false);
  private stopWhenHidden=()=>{if(typeof document!=='undefined'&&document.hidden)this.setTalking(false);};
  constructor(options:RadioOptions){
    this.options=options;
    if(typeof window!=='undefined')window.addEventListener('blur',this.stopOnBlur);
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.stopWhenHidden);
    this.emit();
  }
  get status():RadioStatus{return this.getStatus();}
  getStatus():RadioStatus{return {enabled:this.enabled,microphone:this.microphone,talking:this.talking,secure:typeof window!=='undefined'&&window.isSecureContext,supported:typeof RTCPeerConnection!=='undefined',micLevel:this.micLevel,error:this.error,caption:this.caption,peers:[...this.peers.values()].map(p=>({id:p.id,state:p.pc.connectionState,talking:p.talking,signalingState:p.pc.signalingState,iceGatheringState:p.pc.iceGatheringState,iceConnectionState:p.pc.iceConnectionState,localDescription:!!p.pc.localDescription,remoteDescription:!!p.pc.remoteDescription,localCandidateCount:p.localCandidateCount,remoteCandidateCount:p.remoteCandidateCount}))};}
  private emit(){if(!this.disposed)this.options.onState(this.getStatus());}
  private isCurrentSession(generation:number):boolean{return !this.disposed&&this.enabled&&generation===this.playbackGeneration;}
  private isCurrentPeer(peer:Peer):boolean{return !this.disposed&&this.enabled&&this.peers.get(peer.id)===peer;}
  private invalidateSignaling():void{
    this.playbackGeneration++;this.seen.clear();this.acknowledgements.clear();
    // Retired browser operations may still settle, but must not block a new radio session.
    this.receiving=Promise.resolve();this.receiveScheduled=false;
  }
  private training(){return this.options.selfId==='training'||this.options.selfId.startsWith('training-');}
  private async send(action:string,payload:Record<string,unknown>){if(this.training())return;if(this.disposed&&action!=='radio-status')return;const result=await this.options.send(action,payload);if(result===null)throw new Error('Signalisation radio indisponible.');}
  private updateStatus(payload:Record<string,unknown>):Promise<void>{this.statusSending=this.statusSending.catch(()=>{}).then(async()=>{await this.send('radio-status',payload);});return this.statusSending;}
  private async context():Promise<AudioContext>{
    if(this.disposed)throw new Error('Le talkie a été fermé.');
    if(!this.ctx){
      const Constructor=globalThis.AudioContext??(typeof window!=='undefined'?(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext:undefined);
      if(!Constructor)throw new Error('Audio indisponible sur cet appareil. La transcription du contrôle reste accessible.');
      this.ctx=new Constructor({latencyHint:'interactive'});this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);
      this.noiseBuffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);const channel=this.noiseBuffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=(Math.random()*2-1)*0.5;
      this.meter=setInterval(()=>this.tick(),100);
    }
    if(this.ctx.state==='suspended')await this.ctx.resume();
    return this.ctx;
  }
  /** Explicit user gesture: unlocks playback without asking for microphone access. */
  async enablePlayback():Promise<void>{
    const generation=this.playbackGeneration;
    const cancelled=()=>this.disposed||generation!==this.playbackGeneration;
    try{
      await this.context();
      if(cancelled())return;
      if(!this.training()&&typeof RTCPeerConnection==='undefined')throw new Error('WebRTC est indisponible. La radio textuelle et le contrôle local restent accessibles.');
      if(!this.enabled){this.enabled=true;this.epoch=freshEpoch();this.joiningUntil=Date.now()+5000;this.error=null;await this.updateStatus({enabled:true,talking:false,epoch:this.epoch,activate:true});}
      if(cancelled())return;
      this.sync(this.frame);this.emit();
    }catch(error){if(cancelled())return;this.setTalking(false);this.enabled=false;this.invalidateSignaling();for(const id of [...this.peers.keys()])this.closePeer(id);this.error=error instanceof Error?error.message:'Lecture radio indisponible.';this.emit();throw error;}
  }
  /** The ONLY getUserMedia call in this module. Caller must invoke it from a user click. */
  enableMicrophone():Promise<void>{
    if(this.microphoneRequest)return this.microphoneRequest;
    const request=this.acquireMicrophone(this.microphoneGeneration);
    const pending:Promise<void>=request.finally(()=>{if(this.microphoneRequest===pending)this.microphoneRequest=null;});
    this.microphoneRequest=pending;return pending;
  }
  private async acquireMicrophone(generation:number):Promise<void>{
    const cancelled=()=>this.disposed||generation!==this.microphoneGeneration;
    let stream:MediaStream|null=null;
    const stopReturnedStream=()=>stream?.getTracks().forEach(track=>track.stop());
    if(this.training()){this.error='Le microphone est réservé aux équipes coopératives. Le contrôle local reste disponible.';this.emit();throw new Error(this.error);}
    if(typeof window==='undefined'||!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){this.error='Microphone indisponible : ouvrez HTTPS avec un certificat approuvé, ou localhost. Le texte et l’étalonnage restent utilisables.';this.emit();throw new Error(this.error);}
    try{
      await this.enablePlayback();
      if(cancelled()||!this.enabled)return;
      if(this.microphone)return;
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      const received=stream;received.getAudioTracks().forEach(track=>{track.enabled=false;});
      // Permission cannot be aborted, but an extinguished or replaced activation must never adopt its stream.
      if(cancelled()||!this.enabled){stopReturnedStream();return;}
      const ctx=await this.context();
      if(cancelled()||!this.enabled){stopReturnedStream();return;}
      received.getAudioTracks().forEach(track=>{track.onended=()=>{if(this.mic===received&&this.microphone){this.microphone=false;this.setTalking(false);this.error='Le microphone a été déconnecté. Réactivez-le pour transmettre.';this.emit();}};});
      this.mic=received;this.microphone=true;this.error=null;
      this.micSource=ctx.createMediaStreamSource(received);this.analyser=ctx.createAnalyser();this.analyser.fftSize=256;this.silent=ctx.createGain();this.silent.gain.value=0;this.micSource.connect(this.analyser);this.analyser.connect(this.silent);this.silent.connect(ctx.destination);
      await Promise.all([...this.peers.values()].map(peer=>peer.transceiver.sender.replaceTrack(received.getAudioTracks()[0]).catch(()=>{})));
      if(cancelled()){stopReturnedStream();return;}
      this.emit();
    }catch(error){if(cancelled()){stopReturnedStream();return;}if(stream&&this.mic===stream)this.disableMicrophone();else stopReturnedStream();this.error=error instanceof Error&&error.name==='NotAllowedError'?'Accès au microphone refusé. Vous pouvez écouter, utiliser le texte et lancer le contrôle.':error instanceof Error?error.message:'Microphone indisponible.';this.emit();throw error;}
  }
  disableMicrophone():void{
    this.microphoneGeneration++;this.microphoneRequest=null;
    this.setTalking(false);this.microphone=false;this.mic?.getTracks().forEach(track=>{track.onended=null;track.stop();});this.mic=null;this.micSource?.disconnect();this.analyser?.disconnect();this.silent?.disconnect();this.micSource=null;this.analyser=null;this.silent=null;this.micLevel=0;
    for(const peer of this.peers.values())void peer.transceiver.sender.replaceTrack(null).catch(()=>{});
    this.emit();
  }
  setTalking(value:boolean):void{
    const active=value&&this.enabled&&this.microphone&&!this.disposed;
    if(active===this.talking)return;
    this.talking=active;this.mic?.getAudioTracks().forEach(track=>track.enabled=active);
    if(this.keepAlive)clearInterval(this.keepAlive);this.keepAlive=null;if(this.pttLimit)clearTimeout(this.pttLimit);this.pttLimit=null;
    for(const peer of this.peers.values())if(peer.channel?.readyState==='open')try{peer.channel.send(JSON.stringify({type:'ptt',talking:active}));}catch{/* A closing channel must not keep the microphone open. */}
    if(this.enabled)void this.updateStatus({enabled:true,talking:active,epoch:this.epoch}).catch(()=>{this.error='Signalisation interrompue. Relâchez le talkie puis réessayez.';if(active)this.setTalking(false);this.emit();});
    if(active){this.keepAlive=setInterval(()=>{void this.updateStatus({enabled:true,talking:true,epoch:this.epoch}).catch(()=>this.setTalking(false));},3000);this.pttLimit=setTimeout(()=>{this.setTalking(false);this.caption='Transmission limitée à 30 secondes. Relâchez puis appuyez pour reprendre.';this.emit();},30_000);}
    this.squelch(active?0.045:0.07);this.emit();
  }
  setVolume(value:number):void{this.volume=Math.max(0,Math.min(1,Number.isFinite(value)?value:0.7));if(this.master&&this.ctx)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,0.03);}
  setIceServers(iceServers:RTCIceServer[]):void{
    this.options.iceServers=iceServers;
    for(const peer of this.peers.values())try{peer.pc.setConfiguration({...peer.pc.getConfiguration(),iceServers});if(['failed','disconnected'].includes(peer.pc.connectionState))peer.pc.restartIce();}catch{this.error='La configuration du relais radio n’a pas pu être actualisée.';this.emit();}
  }
  async reconnect():Promise<void>{
    if(!this.enabled){await this.enablePlayback();return;}
    this.setTalking(false);this.invalidateSignaling();for(const id of [...this.peers.keys()])this.closePeer(id);this.epoch=freshEpoch();this.joiningUntil=Date.now()+5000;this.error=null;
    const generation=this.playbackGeneration;
    await this.updateStatus({enabled:true,talking:false,epoch:this.epoch,activate:true});
    if(!this.isCurrentSession(generation))return;
    this.sync(this.frame);this.emit();
  }
  disablePlayback():void{
    this.invalidateSignaling();
    const epoch=this.epoch;this.disableMicrophone();this.enabled=false;for(const id of [...this.peers.keys()])this.closePeer(id);
    void this.updateStatus({enabled:false,talking:false,epoch}).catch(()=>{});this.error=null;this.emit();
  }
  setProfile(profile:RadioProfile):void{if(this.profile===profile)return;this.profile=profile;for(const peer of this.peers.values())this.tune(peer);}
  async probe():Promise<{caption:string;audible:boolean}>{
    const pattern=getProbePattern(this.profile);this.caption=pattern.caption;let audible=false;
    try{
      const ctx=await this.context();const start=ctx.currentTime;
      for(const tone of pattern.tones){if(tone.gain===0)continue;const oscillator=ctx.createOscillator();const envelope=ctx.createGain();oscillator.frequency.value=tone.frequency;oscillator.type='sine';envelope.gain.setValueAtTime(0,start+tone.at);envelope.gain.linearRampToValueAtTime(tone.gain,start+tone.at+0.012);envelope.gain.setValueAtTime(tone.gain,start+tone.at+tone.duration-0.02);envelope.gain.linearRampToValueAtTime(0,start+tone.at+tone.duration);oscillator.connect(envelope);envelope.connect(this.master!);
        if(pattern.modulated){const mod=ctx.createOscillator();const amount=ctx.createGain();mod.frequency.value=32;amount.gain.value=70;mod.connect(amount);amount.connect(oscillator.frequency);mod.start(start+tone.at);mod.stop(start+tone.at+tone.duration);mod.onended=()=>{mod.disconnect();amount.disconnect();};}
        oscillator.start(start+tone.at);oscillator.stop(start+tone.at+tone.duration+0.01);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
      }
      if(pattern.noise)this.squelch(2.1,0.022);
      audible=ctx.state==='running';
    }catch(error){this.error=error instanceof Error?error.message:'Audio indisponible. Utilisez le résultat écrit du contrôle.';}
    this.emit();return {caption:pattern.caption,audible};
  }
  syncPublicRoom(frame:RadioFrame):void{this.sync(frame);}
  sync(frame:RadioFrame):void{
    this.frame=frame;if(this.disposed||this.training())return;
    const self=frame.players.find(p=>p.id===this.options.selfId);
    if(!this.enabled){if(!this.epoch&&!this.clearedPreviousSession&&self?.radioEnabled){this.clearedPreviousSession=true;void this.updateStatus({enabled:false,talking:false,epoch:self.radioEpoch??''}).catch(()=>{});}return;}
    if(self?.radioEnabled&&self.radioEpoch&&self.radioEpoch!==this.epoch&&Date.now()>this.joiningUntil){this.invalidateSignaling();this.disableMicrophone();this.enabled=false;for(const id of [...this.peers.keys()])this.closePeer(id);this.error='Le talkie est actif dans un autre onglet. Réactivez-le ici si nécessaire.';this.emit();return;}
    const active=frame.players.filter(p=>p.id!==this.options.selfId&&p.connected&&p.radioEnabled&&p.radioEpoch);
    if(active.length===0&&this.talking)this.setTalking(false);
    for(const [id,peer] of this.peers)if(!active.some(p=>p.id===id&&p.radioEpoch===peer.epoch))this.closePeer(id);
    for(const player of active){const peer=this.peer(player.id,player.radioEpoch!);if(Date.now()-peer.lastTalkData>2500)this.remoteTalking(peer,player.talking===true);}
    if(!this.receiveScheduled){
      this.receiveScheduled=true;
      const generation=this.playbackGeneration,epoch=this.epoch;
      const current=()=>this.isCurrentSession(generation)&&this.epoch===epoch;
      this.receiving=this.receiving.then(async()=>{
        if(!current())return;
        const inbox=this.frame.radioInbox??[];
        for(const signal of inbox){
          if(!current())return;
          if(signal.to!==this.options.selfId||signal.toEpoch!==epoch)continue;
          if(!this.seen.has(signal.id)){
            this.seen.add(signal.id);if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);
            try{await this.receive(signal,generation);}catch(error){if(current())this.error=error instanceof Error?error.message:'Négociation radio interrompue.';}
          }
          if(!current())return;
          this.acknowledgements.add(signal.id);
        }
        if(this.acknowledgements.size){
          const ids=[...this.acknowledgements].slice(0,128);
          try{await this.send('signal-ack',{ids});if(current())ids.forEach(id=>this.acknowledgements.delete(id));}catch{/* Keep IDs for the current session's next poll. */}
        }
      }).finally(()=>{if(generation===this.playbackGeneration){this.receiveScheduled=false;this.emit();}});
    }
  }
  private peer(id:string,epoch:string):Peer{
    const existing=this.peers.get(id);if(existing?.epoch===epoch)return existing;if(existing)this.closePeer(id);
    const pc=new RTCPeerConnection({iceServers:this.options.iceServers??[{urls:'stun:stun.l.google.com:19302'}],bundlePolicy:'max-bundle'});
    const transceiver=pc.addTransceiver('audio',{direction:'sendrecv'});
    const peer:Peer={id,epoch,pc,transceiver,makingOffer:false,ignoreOffer:false,settingAnswer:false,polite:isPolitePeer(this.options.selfId,id),candidates:[],sending:Promise.resolve(),channel:null,receiver:null,talking:false,lastTalkData:0,restartCount:0,restartTimer:null,connectTimer:null,localCandidateCount:0,remoteCandidateCount:0};
    this.peers.set(id,peer);
    if(this.mic)void transceiver.sender.replaceTrack(this.mic.getAudioTracks()[0]).catch(()=>{});
    pc.onnegotiationneeded=()=>{void this.negotiate(peer);};
    pc.onicecandidate=event=>{if(!this.isCurrentPeer(peer))return;if(event.candidate)peer.localCandidateCount++;void this.signal(peer,{candidate:event.candidate?.toJSON()??null}).catch(()=>{});this.emit();};
    pc.ontrack=event=>{if(!this.isCurrentPeer(peer)){event.track.stop();return;}const stream=event.streams[0]??new MediaStream([event.track]);this.attachReceiver(peer,stream);event.track.onended=()=>{if(this.isCurrentPeer(peer))this.dropReceiver(peer);};};
    pc.ondatachannel=event=>{if(!this.isCurrentPeer(peer)){event.channel.close();return;}this.attachChannel(peer,event.channel);};
    if(this.options.selfId<id)this.attachChannel(peer,pc.createDataChannel('parallaxe-radio',{ordered:true}));
    pc.onconnectionstatechange=()=>{if(!this.isCurrentPeer(peer))return;if(pc.connectionState==='connected'){peer.restartCount=0;this.error=null;if(peer.connectTimer)clearTimeout(peer.connectTimer);peer.connectTimer=null;}if(['failed','disconnected'].includes(pc.connectionState)){this.setTalking(false);if(!peer.restartTimer)peer.restartTimer=setTimeout(()=>{peer.restartTimer=null;if(!this.isCurrentPeer(peer))return;if(['failed','disconnected'].includes(pc.connectionState)&&peer.restartCount<2){peer.restartCount++;pc.restartIce();}else if(pc.connectionState==='failed'){this.error='Liaison vocale impossible entre ces réseaux. Un relais TURN peut être nécessaire ; le texte et le contrôle local fonctionnent encore.';this.emit();}},5000);}this.emit();};
    peer.connectTimer=setTimeout(()=>{if(this.peers.get(id)!==peer||pc.connectionState==='connected')return;this.error=!pc.localDescription?'La négociation du talkie n’a pas démarré. Essayez de reconnecter la radio.':!pc.remoteDescription?'Le talkie attend la réponse de son partenaire. Vérifiez sa radio et la liaison de signalisation.':peer.localCandidateCount===0?'Le navigateur n’a fourni aucun chemin réseau pour la voix. Un relais TURN ou un autre réseau peut être nécessaire.':'La liaison vocale n’a pas abouti après 30 secondes. Reconnectez le talkie ou configurez un relais TURN.';this.emit();},30_000);
    // Initial offer ownership is deterministic. Explicit scheduling also covers browsers
    // that defer negotiationneeded until after a media permission interaction.
    if(this.options.selfId<id)queueMicrotask(()=>{void this.negotiate(peer);});
    this.emit();return peer;
  }
  private async negotiate(peer:Peer):Promise<void>{
    const pc=peer.pc,generation=this.playbackGeneration;
    const current=()=>this.isCurrentSession(generation)&&this.isCurrentPeer(peer);
    if(!current()||peer.makingOffer||pc.signalingState!=='stable')return;
    if(!pc.remoteDescription&&this.options.selfId>peer.id)return;
    try{peer.makingOffer=true;await pc.setLocalDescription();if(current()&&pc.localDescription)await this.signal(peer,{description:{type:pc.localDescription.type as 'offer'|'answer',sdp:pc.localDescription.sdp}});}catch(error){if(current()&&(pc.signalingState as RTCSignalingState)!=='closed'){this.error=error instanceof Error?error.message:'Négociation radio impossible.';this.emit();}}finally{peer.makingOffer=false;if(current())this.emit();}
  }
  private signal(peer:Peer,data:Record<string,unknown>):Promise<void>{
    const generation=this.playbackGeneration,epoch=this.epoch;
    const current=()=>this.isCurrentSession(generation)&&this.isCurrentPeer(peer);
    peer.sending=peer.sending.catch(()=>{}).then(async()=>{
      for(let attempt=0;attempt<3;attempt++){
        if(!current())return;
        try{await this.send('signal',{signal:{to:peer.id,epoch,toEpoch:peer.epoch,...data}});return;}
        catch(error){if(!current())return;if(attempt===2){this.error='Signalisation radio interrompue. La radio textuelle reste disponible.';this.emit();throw error;}await new Promise(resolve=>setTimeout(resolve,180*(attempt+1)));}
      }
    });return peer.sending;
  }
  private async receive(signal:RadioSignal,generation:number):Promise<void>{
    if(!this.isCurrentSession(generation)||signal.toEpoch!==this.epoch)return;
    const player=this.frame.players.find(p=>p.id===signal.from&&p.connected&&p.radioEnabled&&p.radioEpoch===signal.fromEpoch);if(!player)return;
    const peer=this.peer(signal.from,signal.fromEpoch);const pc=peer.pc;
    const current=()=>this.isCurrentSession(generation)&&this.isCurrentPeer(peer)&&signal.toEpoch===this.epoch;
    if(signal.reset){pc.restartIce();return;}
    if(signal.description){
      const description=signal.description;const ready=!peer.makingOffer&&(pc.signalingState==='stable'||peer.settingAnswer);const collision=description.type==='offer'&&!ready;
      peer.ignoreOffer=!peer.polite&&collision;if(peer.ignoreOffer){peer.candidates=[];return;}
      peer.settingAnswer=description.type==='answer';
      // A remote departure/restart can retire this peer without changing our local session.
      try{await pc.setRemoteDescription(description);}
      catch(error){if(current())throw error;return;}
      finally{peer.settingAnswer=false;}
      if(!current())return;
      for(const candidate of peer.candidates.splice(0)){
        if(!current())return;
        try{await pc.addIceCandidate(candidate??undefined);}catch(error){if(current()&&!peer.ignoreOffer)throw error;}
      }
      if(!current())return;
      if(description.type==='offer'){
        try{await pc.setLocalDescription();}catch(error){if(current())throw error;return;}
        if(current()&&pc.localDescription)await this.signal(peer,{description:{type:pc.localDescription.type as 'offer'|'answer',sdp:pc.localDescription.sdp}});
      }
    }else if('candidate'in signal){
      if(signal.candidate)peer.remoteCandidateCount++;
      if(peer.ignoreOffer)return;
      if(!pc.remoteDescription){peer.candidates.push(signal.candidate??null);if(peer.candidates.length>64)peer.candidates.shift();}
      else try{await pc.addIceCandidate(signal.candidate??undefined);}catch(error){if(current()&&!peer.ignoreOffer)throw error;}
    }
  }
  private attachChannel(peer:Peer,channel:RTCDataChannel){
    if(channel.label!=='parallaxe-radio'){channel.close();return;}peer.channel=channel;
    channel.onopen=()=>{if(this.isCurrentPeer(peer)&&peer.channel===channel&&channel.readyState==='open')channel.send(JSON.stringify({type:'ptt',talking:this.talking}));};
    channel.onmessage=event=>{if(!this.isCurrentPeer(peer)||peer.channel!==channel||typeof event.data!=='string'||event.data.length>160)return;try{const data=JSON.parse(event.data);if(data.type==='ptt'&&typeof data.talking==='boolean'){peer.lastTalkData=Date.now();this.remoteTalking(peer,data.talking);}}catch{/* Ignore malformed peer control messages. */}};
  }
  private remoteTalking(peer:Peer,value:boolean){const changed=peer.talking!==value;const ended=peer.talking&&!value;peer.talking=value;if(changed)this.squelch(value?0.045:0.065,0.011);if(ended&&this.profile==='aftertone')this.aftertone();this.tune(peer);this.emit();}
  private attachReceiver(peer:Peer,stream:MediaStream){
    if(!this.ctx||!this.master)return;this.dropReceiver(peer);const ctx=this.ctx;
    const source=ctx.createMediaStreamSource(stream),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),compressor=ctx.createDynamicsCompressor(),shape=ctx.createWaveShaper(),mod=ctx.createGain(),osc=ctx.createOscillator(),depth=ctx.createGain(),gate=ctx.createGain(),dry=ctx.createGain(),delay=ctx.createDelay(1),wet=ctx.createGain(),feedback=ctx.createGain(),noise=ctx.createBufferSource(),noiseGain=ctx.createGain();
    high.type='highpass';low.type='lowpass';compressor.threshold.value=-26;compressor.knee.value=18;compressor.ratio.value=5;compressor.attack.value=0.004;compressor.release.value=0.13;
    const curve=new Float32Array(2048);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*1.65)/Math.tanh(1.65);}shape.curve=curve;shape.oversample='2x';
    source.connect(high);high.connect(low);low.connect(compressor);compressor.connect(shape);shape.connect(mod);mod.connect(gate);gate.connect(dry);dry.connect(this.master);gate.connect(delay);delay.connect(wet);wet.connect(this.master);delay.connect(feedback);feedback.connect(delay);osc.connect(depth);depth.connect(mod.gain);osc.frequency.value=32;osc.start();
    noise.buffer=this.noiseBuffer;noise.loop=true;noise.connect(noiseGain);noiseGain.connect(this.master);noise.start();
    peer.receiver={source,high,low,compressor,shape,mod,osc,depth,gate,dry,delay,wet,feedback,noise,noiseGain};this.tune(peer);
  }
  private tune(peer:Peer){const r=peer.receiver,ctx=this.ctx;if(!r||!ctx)return;const at=ctx.currentTime;
    r.high.frequency.setTargetAtTime(this.profile==='wrong_channel'?850:330,at,0.03);r.low.frequency.setTargetAtTime(this.profile==='wrong_channel'?1600:3300,at,0.03);
    r.depth.gain.setTargetAtTime(this.profile==='detune'?0.8:0,at,0.02);r.mod.gain.setTargetAtTime(1,at,0.02);r.delay.delayTime.setTargetAtTime(0.27,at,0.02);r.wet.gain.setTargetAtTime(this.profile==='echo'?0.6:0,at,0.02);r.feedback.gain.setTargetAtTime(this.profile==='echo'?0.26:0,at,0.02);
    r.noiseGain.gain.setTargetAtTime(this.profile==='static'&&peer.talking?0.018:0,at,0.02);
  }
  private tick(){
    if(this.analyser&&this.microphone){const samples=new Uint8Array(this.analyser.frequencyBinCount);this.analyser.getByteTimeDomainData(samples);this.micLevel=Math.min(1,Math.sqrt(samples.reduce((sum,v)=>sum+((v-128)/128)**2,0)/samples.length)*4);}else this.micLevel=0;
    if(this.ctx)for(const peer of this.peers.values())if(peer.receiver)peer.receiver.gate.gain.setTargetAtTime(this.profile==='chop'&&Date.now()%850<260?0:0.95,this.ctx.currentTime,0.015);
    this.emit();
  }
  private squelch(duration:number,gain=0.014){if(!this.ctx||!this.master||!this.noiseBuffer)return;const ctx=this.ctx;const source=ctx.createBufferSource();const envelope=ctx.createGain();source.buffer=this.noiseBuffer;envelope.gain.setValueAtTime(gain,ctx.currentTime);envelope.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+duration);source.connect(envelope);envelope.connect(this.master);source.start();source.stop(ctx.currentTime+duration);source.onended=()=>{source.disconnect();envelope.disconnect();};}
  private aftertone(){if(!this.ctx||!this.master)return;const ctx=this.ctx;const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.frequency.value=165;gain.gain.setValueAtTime(0.035,ctx.currentTime+0.25);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.85);oscillator.connect(gain);gain.connect(this.master);oscillator.start(ctx.currentTime+0.25);oscillator.stop(ctx.currentTime+0.9);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
  private dropReceiver(peer:Peer){const r=peer.receiver;if(!r)return;try{r.osc.stop();r.noise.stop();}catch{}for(const node of Object.values(r))node.disconnect();peer.receiver=null;}
  private closePeer(id:string){
    const peer=this.peers.get(id);if(!peer)return;this.peers.delete(id);
    if(peer.restartTimer)clearTimeout(peer.restartTimer);if(peer.connectTimer)clearTimeout(peer.connectTimer);this.dropReceiver(peer);
    if(peer.channel){peer.channel.onopen=null;peer.channel.onmessage=null;peer.channel.close();}
    peer.pc.onicecandidate=null;peer.pc.onconnectionstatechange=null;peer.pc.onnegotiationneeded=null;peer.pc.ontrack=null;peer.pc.ondatachannel=null;peer.pc.close();
  }
  dispose():void{
    if(this.disposed)return;this.invalidateSignaling();this.setTalking(false);this.disableMicrophone();if(this.enabled)void this.updateStatus({enabled:false,talking:false,epoch:this.epoch}).catch(()=>{});this.enabled=false;this.disposed=true;
    for(const id of [...this.peers.keys()])this.closePeer(id);if(this.meter)clearInterval(this.meter);if(this.keepAlive)clearInterval(this.keepAlive);if(this.pttLimit)clearTimeout(this.pttLimit);
    this.master?.disconnect();void this.ctx?.close().catch(()=>{});this.ctx=null;this.master=null;
    if(typeof window!=='undefined')window.removeEventListener('blur',this.stopOnBlur);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.stopWhenHidden);
  }
}
