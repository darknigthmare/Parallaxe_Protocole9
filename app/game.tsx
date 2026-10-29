"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, AudioLines, BookOpen, Check, ChevronLeft, CircleHelp, Copy, Eye, EyeOff, Flashlight, Fullscreen, Headphones, LoaderCircle, MessageSquare, Pause, Radio, Settings2, ShieldCheck, Volume2, VolumeX, X, Users, AlertTriangle, Crosshair, Download, RotateCcw, DoorOpen } from "lucide-react";
import { createRun, advanceRun, evaluateRun, getPersonalView, migrateRun, type Run, type Difficulty } from "@/src/game/rules";
import { ANOMALIES } from "@/src/game/catalog";
import { Atmosphere } from "@/src/game/audio";
import type { createScene } from "@/src/game/scene";
import type { PublicRoom } from "@/src/game/session";
import { getLevel, type LevelId } from "@/src/game/levels";
import { RadioClient, profileForEffects, radioReferenceCaption, type RadioStatus } from "@/src/game/radio";
import { RadioActionGate } from "@/src/game/radio-actions";
import { SessionScope } from "@/src/game/session-scope";
import { MissionSelector, MISSION_LOCATIONS, type MissionChoice } from "./mission-selector";
import { RadioPanel, TalkButton } from "./radio-panel";

type Engine = ReturnType<typeof createScene>;
type Modal = "none" | "start" | "coop" | "help" | "settings" | "archives" | "journal" | "vote" | "pause" | "radio";
type Credentials = {code:string;token:string;selfId:string};
type Reveal={correct:boolean;hasAnomaly:boolean;title:string;description:string;anomalyId?:string|null;observerNames?:string[]};
type OnlineState=PublicRoom;
type SessionResponse={code?:string;token?:string;selfId?:string;state?:OnlineState;error?:string;message?:string};
type Preferences={volume:number;radioVolume:number;sensitivity:number;quality:"low"|"medium"|"high";muted:boolean;reduceMotion:boolean};
const DEFAULTS:Preferences={volume:0.38,radioVolume:0.75,sensitivity:1,quality:"medium",muted:false,reduceMotion:false};
const LETTERS=["α","β","γ","δ"];
function safeRead<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback;}catch{return fallback;}}
function safeWrite(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Safari private storage may be unavailable. */}}
function Brand({compact=false}:{compact?:boolean}){return <div className={"brand "+(compact?"brand-small":"")}><span className="brand-mark" aria-hidden="true"><i/><i/></span><div><b>PARALLAXE</b><span>PROGRAMME D’OBSERVATION · 09</span></div></div>;}
function IconButton({title,onClick,children,active=false}:{title:string;onClick:()=>void;children:React.ReactNode;active?:boolean}){return <button className={"icon-button "+(active?"active":"")} title={title} aria-label={title} onClick={onClick}>{children}</button>;}
function Key({children}:{children:React.ReactNode}){return <kbd>{children}</kbd>;}

export default function Game({portable=false}:{portable?:boolean}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const engine=useRef<Engine|null>(null);
  const audio=useRef<Atmosphere|null>(null);
  const radio=useRef<RadioClient|null>(null);
  const [radioStatus,setRadioStatus]=useState<RadioStatus|null>(null);
  const [radioPending,setRadioPending]=useState(false);
  const radioActions=useRef<RadioActionGate|null>(null);
  if(!radioActions.current)radioActions.current=new RadioActionGate(setRadioPending);
  const [radioCaption,setRadioCaption]=useState("");
  const [mission,setMission]=useState<MissionChoice>({mode:"campaign",levelId:"hotel"});
  const [previewLevel,setPreviewLevel]=useState<LevelId>("hotel");
  const padHeld=useRef<boolean[]>([]);
  const refreshRadioConfig=useRef<()=>Promise<void>>(async()=>{});
  const keys=useRef(new Set<string>());
  const touchMove=useRef({forward:0,strafe:0});
  const frameState=useRef({playing:false,blocked:true,sensitivity:1,reduceMotion:false,radioInput:false});
  const actions=useRef({interact:()=>{},vote:()=>{},journal:()=>{},torch:()=>{},switchView:()=>{},pause:()=>{}});
  const [ready,setReady]=useState(false);
  const [graphicsError,setGraphicsError]=useState("");
  const [graphicsDismissed,setGraphicsDismissed]=useState(false);
  const [run,setRun]=useState<Run|null>(null);
  const [online,setOnline]=useState<OnlineState|null>(null);
  const [credentials,setCredentials]=useState<Credentials|null>(null);
  const credRef=useRef<Credentials|null>(null);
  const [modal,setModal]=useState<Modal>("none");
  const [slot,setSlot]=useState(0);
  const [preferences,setPreferences]=useState<Preferences>(DEFAULTS);
  const [difficulty,setDifficulty]=useState<Difficulty>("standard");
  const [name,setName]=useState("Inspecteur");
  const [joinCode,setJoinCode]=useState("");
  const [seed,setSeed]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [networkDown,setNetworkDown]=useState(false);
  const [toast,setToast]=useState("");
  const [target,setTarget]=useState<{id:string;label:string}|null>(null);
  const [torch,setTorch]=useState(true);
  const [locked,setLocked]=useState(false);
  const [known,setKnown]=useState<string[]>([]);
  const [spoilers,setSpoilers]=useState(false);
  const [savedRun,setSavedRun]=useState<Run|null>(null);
  const [savedSession,setSavedSession]=useState<Credentials|null>(null);
  const [chat,setChat]=useState("");
  const [notes,setNotes]=useState<string[]>([]);
  const [isTouch,setIsTouch]=useState(false);
  const [confirmLeave,setConfirmLeave]=useState(false);
  const [archiveFilter,setArchiveFilter]=useState("");
  const sessionScope=useRef<SessionScope|null>(null);
  if(!sessionScope.current)sessionScope.current=new SessionScope();
  const lastReveal=useRef("");
  const lastPhase=useRef("");
  const postInFlight=useRef(false);
  const [touchStick,setTouchStick]=useState({x:0,y:0});
  const joystickOrigin=useRef<{x:number;y:number;id:number}|null>(null);
  const touchLook=useRef<{x:number;y:number;id:number}|null>(null);

  const active=!!run||!!online;
  const phase=online?.phase??run?.phase??"menu";
  const streak=online?.streak??run?.streak??0;
  const strikes=online?.strikes??run?.strikes??0;
  const loop=online?.loop??run?.loop??0;
  const playing=active&&phase!=="lobby";
  const self=online?.players.find(p=>p.id===credentials?.selfId);
  const currentSlot=online?self?.slot??0:slot;
  const levelId=online?.levelId??run?.levelId??previewLevel;
  const level=getLevel(levelId);
  const missionMode=online?.mode??run?.mode??mission.mode;
  const currentView=online?.view??(run?getPersonalView(run,slot):{effects:[],variant:0,phase:"menu",loop:0,levelId:previewLevel});
  const radioSetup=useRef({volume:preferences.radioVolume,profile:profileForEffects(currentView.effects),frame:online});
  radioSetup.current={volume:preferences.muted?0:preferences.radioVolume,profile:profileForEffects(currentView.effects),frame:online};
  const isHost=!!online&&online.hostId===credentials?.selfId;
  const reveal=(online?.reveal??run?.lastResult) as Reveal|undefined;
  const roundFinished=["reveal","won","lost"].includes(phase);
  const inputBlocked=modal!=="none"||roundFinished||phase==="lobby";

  const notify=useCallback((message:string)=>{setToast(message);},[]);
  const stopRadio=useCallback(()=>{radioActions.current?.cancel();radio.current?.disablePlayback();},[]);
  const stopMicrophone=useCallback(()=>{radioActions.current?.cancel();radio.current?.disableMicrophone();},[]);
  const openModal=useCallback((m:Modal)=>{radio.current?.setTalking(false);document.exitPointerLock?.();setModal(m);setError("");audio.current?.tone("click");},[]);
  const resetSession=useCallback((credential:Credentials|null)=>{
    sessionScope.current!.replace(credential);credRef.current=credential;
    postInFlight.current=false;setBusy(false);setNetworkDown(false);
    setCredentials(credential);setOnline(null);lastPhase.current="";lastReveal.current="";
  },[]);
  const acceptState=useCallback((state:OnlineState)=>{
    if(!sessionScope.current!.accept(state))return;
    setOnline(state);setNetworkDown(false);
  },[]);
  useEffect(()=>()=>{sessionScope.current!.invalidate();},[]);
  const request=useCallback(async(action:string,extra:Record<string,unknown>={},quiet=false)=>{
    if(postInFlight.current&&!quiet)return null;
    const scope=sessionScope.current!;const ticket=scope.ticket();
    const credential=credRef.current;const opening=action==="create"||action==="join";
    if(!opening&&!credential)return null;
    if(!quiet){postInFlight.current=true;setBusy(true);setError("");}
    try{
      const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json",...(credential&&!opening?{Authorization:`Bearer ${credential.token}`}:{})},body:JSON.stringify({...extra,action,...(credential&&!opening?{code:credential.code}:{})}),signal:AbortSignal.timeout(10000)});
      const payload=await response.json() as SessionResponse;
      if(!scope.isCurrent(ticket))return null;
      if(!response.ok)throw new Error(payload.error||payload.message||"La liaison n’a pas pu être établie.");
      if(opening){
        if(!payload.token||!payload.code||!payload.selfId||!payload.state||payload.state.code!==payload.code||payload.state.selfId!==payload.selfId)throw new Error("La réponse du salon est incomplète. Réessayez.");
        const c={code:payload.code,token:payload.token,selfId:payload.selfId};
        resetSession(c);setSavedSession(c);
        try{sessionStorage.setItem("parallaxe-session",JSON.stringify(c));}catch{}
        setRun(null);setModal("none");
      }
      if(payload.state)acceptState(payload.state);
      return payload;
    }catch(e){
      if(scope.isCurrent(ticket)){const message=e instanceof Error?e.message:"Connexion interrompue.";if(!quiet)setError(message);else setNetworkDown(true);}
      return null;
    }finally{if(!quiet&&scope.isCurrent(ticket)){postInFlight.current=false;setBusy(false);}}
  },[acceptState,resetSession]);

  useEffect(()=>{
    const p=safeRead<Preferences>("parallaxe-preferences",DEFAULTS);setPreferences({...DEFAULTS,...p});
    const k=safeRead<unknown>("parallaxe-archives",[]);if(Array.isArray(k))setKnown(k.filter(x=>typeof x==="string"));
    const saved=migrateRun(safeRead<unknown>("parallaxe-training",null));if(saved&&["reference","inspect","reveal"].includes(saved.phase))setSavedRun(saved);
    const n=safeRead<string>("parallaxe-name","Inspecteur");if(typeof n==="string")setName(n.slice(0,24));
    try{const c=JSON.parse(sessionStorage.getItem("parallaxe-session")||"null");if(c?.code&&c?.token)setSavedSession(c);}catch{}
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  },[]);

  useEffect(()=>{
    let destroyed=false;let raf=0;let last=performance.now();let targetTick=0;
    audio.current=new Atmosphere();
    import("@/src/game/scene").then(({createScene})=>{
      if(destroyed||!canvasRef.current)return;
      const world=createScene(canvasRef.current,{onInteract:()=>actions.current.interact()});
      engine.current=world;world.setQuality("medium");world.setFlashlight(true);setReady(true);
      const animate=(now:number)=>{
        if(destroyed)return;
        const dt=Math.min((now-last)/1000,0.05);last=now;
        const s=frameState.current;let forward=0;let strafe=0;
        if(s.playing&&!s.blocked){
          const held=keys.current;
          forward=Number(held.has("KeyW")||held.has("KeyZ")||held.has("ArrowUp"))-Number(held.has("KeyS")||held.has("ArrowDown"))+touchMove.current.forward;
          strafe=Number(held.has("KeyD")||held.has("ArrowRight"))-Number(held.has("KeyA")||held.has("KeyQ")||held.has("ArrowLeft"))+touchMove.current.strafe;
          const pad=navigator.getGamepads?.()[0];
          if(pad){const dead=(v:number)=>Math.abs(v)>0.15?v:0;forward-=dead(pad.axes[1]??0);strafe+=dead(pad.axes[0]??0);world.look(dead(pad.axes[2]??0)*dt*500*s.sensitivity,dead(pad.axes[3]??0)*dt*500*s.sensitivity);
            const down=pad.buttons.map(button=>button.pressed);const pressed=(index:number)=>down[index]&&!padHeld.current[index];
            if(pressed(0))actions.current.interact();if(pressed(2))actions.current.vote();if(pressed(3))actions.current.torch();if(pressed(8))actions.current.journal();if(pressed(9))actions.current.pause();
            if(down[4]!==padHeld.current[4])radio.current?.setTalking(!!down[4]);padHeld.current=down;
          }else if(padHeld.current.length){padHeld.current=[];radio.current?.setTalking(false);}
          if(Math.abs(forward)+Math.abs(strafe)>0.2)audio.current?.tone("step");
        }
        world.setInput({forward:Math.max(-1,Math.min(1,forward)),strafe:Math.max(-1,Math.min(1,strafe)),sprint:!s.reduceMotion&&keys.current.has("ShiftLeft")});
        world.update(dt);
        if(now-targetTick>130){targetTick=now;const t=world.getTarget();setTarget(old=>old?.id===t?.id&&old?.label===t?.label?old:t);}
        raf=requestAnimationFrame(animate);
      };raf=requestAnimationFrame(animate);
    }).catch(e=>{if(!destroyed)setGraphicsError(e instanceof Error?e.message:"WebGL 2 est indisponible sur cet appareil.");});
    const onLock=()=>setLocked(document.pointerLockElement===canvasRef.current);
    const onBlur=()=>{keys.current.clear();touchMove.current={forward:0,strafe:0};padHeld.current=[];radio.current?.setTalking(false);};
    const onMouse=(e:MouseEvent)=>{if(document.pointerLockElement===canvasRef.current&&!frameState.current.blocked)engine.current?.look(e.movementX*frameState.current.sensitivity,e.movementY*frameState.current.sensitivity);};
    const onKey=(e:KeyboardEvent)=>{
      if(e.type==="keyup"){keys.current.delete(e.code);if(e.code==="KeyT")radio.current?.setTalking(false);return;}
      if((e.target as HTMLElement)?.matches("input,textarea,select"))return;
      keys.current.add(e.code);
      if(e.repeat)return;
      if(e.code==="Escape"&&frameState.current.playing){actions.current.pause();return;}
      if(e.code==="KeyT"&&frameState.current.radioInput){e.preventDefault();radio.current?.setTalking(true);return;}
      if(!frameState.current.playing||frameState.current.blocked)return;
      if(["KeyE","KeyV","KeyF","KeyJ","KeyT","Tab","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
      if(e.code==="KeyE")actions.current.interact();
      if(e.code==="KeyV")actions.current.vote();
      if(e.code==="KeyJ")actions.current.journal();
      if(e.code==="KeyF")actions.current.torch();
      if(e.code==="Tab")actions.current.switchView();
    };
    window.addEventListener("keydown",onKey);window.addEventListener("keyup",onKey);window.addEventListener("blur",onBlur);document.addEventListener("pointerlockchange",onLock);document.addEventListener("mousemove",onMouse);
    return()=>{destroyed=true;cancelAnimationFrame(raf);engine.current?.dispose();engine.current=null;audio.current?.dispose();window.removeEventListener("keydown",onKey);window.removeEventListener("keyup",onKey);window.removeEventListener("blur",onBlur);document.removeEventListener("pointerlockchange",onLock);document.removeEventListener("mousemove",onMouse);};
  },[]);

  useEffect(()=>{frameState.current={playing,blocked:inputBlocked,sensitivity:preferences.sensitivity,reduceMotion:preferences.reduceMotion,radioInput:!!online&&!networkDown&&(playing&&!inputBlocked||modal==="radio"||phase==="lobby")};},[playing,inputBlocked,preferences.sensitivity,preferences.reduceMotion,online!==null,networkDown,modal,phase]);
  useEffect(()=>{
    let disposed=false;
    let client:RadioClient|null=null;
    let configTimer:ReturnType<typeof setInterval>|undefined;
    const initialization=radioActions.current!.begin();setRadioStatus(null);
    const loadConfig=async()=>{
      let iceServers:RTCIceServer[]|undefined;
      if(credentials){
        try{
          const response=await fetch(`/api/session?code=${encodeURIComponent(credentials.code)}&radioConfig=1`,{headers:{Authorization:`Bearer ${credentials.token}`},cache:"no-store",signal:AbortSignal.timeout(8000)});
          if(response.ok){const config=await response.json() as {iceServers?:RTCIceServer[]};iceServers=config.iceServers;}
        }catch{/* The radio reports connection errors separately from game anomalies. */}
      }
      return iceServers;
    };
    const renew=async()=>{const servers=await loadConfig();if(!disposed&&servers)client?.setIceServers(servers);};
    refreshRadioConfig.current=renew;
    const initialize=async()=>{
      const iceServers=await loadConfig();
      if(disposed)return;
      client=new RadioClient({selfId:credentials?.selfId??"training",iceServers,send:async(action,payload)=>{
        if(!credentials)return;
        // A retiring talkie must never send with a newer room's credentials.
        const response=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${credentials.token}`},body:JSON.stringify({action,code:credentials.code,...payload}),signal:AbortSignal.timeout(10000)});
        const result=await response.json() as SessionResponse;
        if(!response.ok)throw new Error(result.error??"La liaison de signalisation radio est interrompue.");
        if(!disposed&&credRef.current?.selfId===credentials.selfId&&result.state)acceptState(result.state);
        return result;
      },onState:state=>{if(!disposed)setRadioStatus(state);}});
      radio.current=client;client.setVolume(radioSetup.current.volume);client.setProfile(radioSetup.current.profile);if(radioSetup.current.frame)client.sync(radioSetup.current.frame);
      if(credentials)configTimer=setInterval(()=>{void renew();},50*60*1000);
      initialization.finish();
    };
    void initialize();
    return()=>{disposed=true;radioActions.current?.invalidate();if(configTimer)clearInterval(configTimer);client?.dispose();if(radio.current===client)radio.current=null;};
  },[credentials?.selfId,acceptState]);
  useEffect(()=>{if(online)radio.current?.sync(online);},[online]);
  useEffect(()=>{radio.current?.setVolume(preferences.muted?0:preferences.radioVolume);},[preferences.radioVolume,preferences.muted,credentials?.selfId]);
  const radioProfile=profileForEffects(currentView.effects);
  useEffect(()=>{radio.current?.setProfile(radioProfile);setRadioCaption("");},[radioProfile,loop,levelId,slot,credentials?.selfId]);
  useEffect(()=>{if(inputBlocked||networkDown||!active)radio.current?.setTalking(false);},[inputBlocked,networkDown,active,modal]);
  useEffect(()=>{engine.current?.setTalking(radioStatus?.talking??false);},[radioStatus?.talking,ready]);
  useEffect(()=>{engine.current?.setIdentity({id:credentials?.selfId??"training",name:online?self?.name??name:"Inspecteur "+(slot===0?"Alpha":"Bêta"),slot:currentSlot});},[credentials?.selfId,self?.name,name,currentSlot,slot,online!==null,ready]);
  useEffect(()=>{engine.current?.setActive(playing);},[playing,ready]);
  useEffect(()=>{engine.current?.setQuality(preferences.quality);audio.current?.setVolume(preferences.volume);audio.current?.setEnabled(!preferences.muted);safeWrite("parallaxe-preferences",preferences);},[preferences,ready]);
  useEffect(()=>{engine.current?.setFlashlight(torch);},[torch,ready]);
  useEffect(()=>{audio.current?.setLocation(levelId);},[levelId,ready]);
  useEffect(()=>{
    if(!ready)return;
    const view=online?.view??(run?getPersonalView(run,slot):{effects:[],variant:0,phase:"menu",loop:0,levelId:previewLevel});
    engine.current?.setView(view);
    const resetKey=`${online?"online":"solo"}:${levelId}:${loop}:${phase==="reference"?"reference":"round"}`;
    if(playing&&resetKey!==lastPhase.current){engine.current?.setPose({x:0,y:1.67,z:9,yaw:0,pitch:0});lastPhase.current=resetKey;setNotes([]);}
    audio.current?.tension(streak/9);
  },[ready,online?.view,run,slot,loop,playing,phase,streak,levelId,previewLevel]);
  useEffect(()=>{engine.current?.setPeers(online?.players.filter(p=>p.id!==credentials?.selfId&&p.connected)??[]);},[online?.players,credentials?.selfId,ready]);
  useEffect(()=>{if(run){safeWrite("parallaxe-training",run);setSavedRun(["won","lost"].includes(run.phase)?null:run);}},[run]);
  useEffect(()=>{
    if(!roundFinished||!reveal)return;
    const key=`${loop}-${phase}-${reveal.title}`;if(lastReveal.current===key)return;lastReveal.current=key;
    document.exitPointerLock?.();setModal("none");audio.current?.tone(reveal.correct?"good":"bad");
    if(reveal.anomalyId)setKnown(previous=>{const updated=[...new Set([...previous,reveal.anomalyId!])];safeWrite("parallaxe-archives",updated);return updated;});
  },[roundFinished,reveal,loop,phase]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),4200);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{
    if(modal==="none")return;
    const previous=document.activeElement as HTMLElement|null;
    const panel=document.querySelector<HTMLElement>(".modal-panel");
    const focusable=()=>Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')??[]);
    focusable()[0]?.focus();
    const trap=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setModal("none");return;}
      if(event.key!=="Tab")return;
      const list=focusable();const first=list[0];const last=list[list.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",trap);
    return()=>{document.removeEventListener("keydown",trap);previous?.focus?.();};
  },[modal]);

  useEffect(()=>{
    if(!credentials)return;
    // Poll ownership is local to this effect: an old finally cannot unlock a new room.
    const scope=sessionScope.current!;const ticket=scope.ticket();
    let cancelled=false;let inFlight=false;let controller:AbortController|null=null;
    const current=()=>!cancelled&&scope.isCurrent(ticket);
    const poll=async()=>{
      if(inFlight||!current())return;inFlight=true;
      const activeController=new AbortController();controller=activeController;
      const timeout=setTimeout(()=>activeController.abort(),8000);
      try{
        const res=await fetch(`/api/session?code=${encodeURIComponent(credentials.code)}`,{headers:{Authorization:`Bearer ${credentials.token}`},signal:activeController.signal,cache:"no-store"});
        const data=await res.json() as SessionResponse;
        if(!current())return;
        if(!res.ok){
          if(res.status===401||res.status===404){
            setError(data.error||"Le salon a expiré. Créez ou rejoignez une nouvelle équipe.");
            resetSession(null);setSavedSession(null);setModal("coop");
            try{sessionStorage.removeItem("parallaxe-session");}catch{}
          }
          throw new Error(data.error||"Liaison perdue.");
        }
        if(data.state)acceptState(data.state);
      }catch{if(current())setNetworkDown(true);}finally{clearTimeout(timeout);inFlight=false;if(controller===activeController)controller=null;}
    };
    void poll();const interval=setInterval(()=>{void poll();},1100);
    const heartbeat=setInterval(()=>{if(current()&&engine.current&&frameState.current.playing)void request("pose",{pose:engine.current.getPose()},true);},750);
    return()=>{cancelled=true;controller?.abort();clearInterval(interval);clearInterval(heartbeat);};
  },[credentials,acceptState,request,resetSession]);

  const capture=()=>{if(inputBlocked||!playing)return;audio.current?.start();if(!isTouch)canvasRef.current?.requestPointerLock?.()?.catch?.(()=>notify("Maintenez le clic et faites glisser pour regarder autour de vous."));};
  const beginSolo=(resume=false)=>{
    stopRadio();resetSession(null);
    const generatedSeed=globalThis.crypto?.randomUUID?.()??`session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next=resume&&savedRun?savedRun:createRun({seed:seed.trim()||generatedSeed,difficulty,players:2,...mission});
    setRun(next);setSlot(0);setModal("none");setError("");setNotes([]);lastPhase.current="";lastReveal.current="";audio.current?.start();
    notify(resume?"Inspection reprise. Retrouvez vos deux perceptions.":"Passage de référence : observez le lieu avant sa première altération.");
  };
  const nextRound=async()=>{audio.current?.start();if(online){if(!await request("next"))return;}else if(run){setRun(advanceRun(run));}setModal("none");};
  const vote=async(value:boolean)=>{if(phase!=="inspect")return;if(online){const r=await request("vote",{vote:value});if(r){setModal("none");notify("Diagnostic transmis. Attendez l’accord de l’équipe.");}}else if(run){setRun(evaluateRun(run,value));setModal("none");}};
  const switchView=()=>{if(online)return;setSlot(s=>1-s);audio.current?.tone("signal");notify(`Perception ${slot===0?"BÊTA":"ALPHA"}. Comparez le même objet.`);};
  const toggleTorch=()=>{setTorch(t=>!t);audio.current?.tone("click");};
  const interact=()=>{
    const t=engine.current?.getTarget();
    if(t?.id==="exit"){if(phase==="inspect")openModal("vote");else if(phase==="reference")openModal("journal");return;}
    if(!t){notify("Visez un objet pour le signaler à votre équipe.");return;}
    audio.current?.tone("signal");
    const label=`${LETTERS[currentSlot].toUpperCase()} · ${t.label}`;
    setNotes(n=>[label,...n.filter(x=>x!==label)].slice(0,12));
    if(online)request("ping",{target:t.id},true);
    notify(`Repère transmis : ${t.label}. Décrivez ce que vous voyez.`);
  };
  actions.current={interact,vote:()=>phase==="inspect"?openModal("vote"):openModal("journal"),journal:()=>openModal("journal"),torch:toggleTorch,switchView,pause:()=>setModal(m=>m!=="none"?"none":"pause")};
  const returnMenu=async()=>{
    stopRadio();
    const leaving=online?request("leave",{},true):null;
    // Retire callbacks immediately; a slow leave must never erase the next session.
    resetSession(null);setRun(null);setModal("none");setError("");setConfirmLeave(false);document.exitPointerLock?.();keys.current.clear();
    if(online){setSavedSession(null);try{sessionStorage.removeItem("parallaxe-session");}catch{}}
    await leaving;
  };
  const resumeSession=()=>{if(!savedSession)return;stopRadio();resetSession(savedSession);setModal("none");setError("");setRun(null);audio.current?.start();notify("Reconnexion au salon en cours…");};
  const fullscreen=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>notify("Sur cet appareil, ouvrez le jeu en plein écran depuis le navigateur."));};
  const copyCode=async()=>{try{await navigator.clipboard.writeText(online?.code??"");notify("Code du salon copié.");}catch{notify(`Code du salon : ${online?.code}`);}};
  const startNetwork=(join:boolean)=>{if(postInFlight.current)return;stopRadio();resetSession(null);safeWrite("parallaxe-name",name);audio.current?.start();void request(join?"join":"create",join?{name:name.trim()||"Inspecteur",code:joinCode.trim().toUpperCase()}:{name:name.trim()||"Inspecteur",difficulty,...mission});};
  const runRadioAction=(action:(client:RadioClient)=>Promise<void>,message:string)=>{
    const client=radio.current;if(!client)return;
    void refreshRadioConfig.current();
    return radioActions.current!.run(()=>action(client),()=>{if(radio.current===client)notify(message);});
  };
  const enableMicrophone=()=>runRadioAction(client=>client.enableMicrophone(),"Le microphone n’a pas pu être activé. Consultez l’état du talkie.");
  const listenRadio=()=>runRadioAction(client=>client.enablePlayback(),"L’écoute radio n’a pas pu démarrer. Consultez l’état du talkie.");
  const reconnectRadio=()=>runRadioAction(client=>client.reconnect(),"La reconnexion radio n’a pas abouti. Consultez son diagnostic.");
  const setTalking=(talking:boolean)=>{if(!talking||!!online&&!networkDown)radio.current?.setTalking(talking);};
  const probeRadio=async()=>{const result=await radio.current?.probe();if(result)setRadioCaption(result.caption);};
  const sendChat=async(e:React.FormEvent)=>{e.preventDefault();if(!chat.trim())return;const r=await request("chat",{message:chat.trim()});if(r)setChat("");};
  const closeModal=()=>{setModal("none");setError("");setConfirmLeave(false);};
  const patchPref=(next:Partial<Preferences>)=>setPreferences(p=>({...p,...next}));
  const renderedAnomalies=ANOMALIES.filter(a=>!archiveFilter||`${a.title} ${a.description}`.toLowerCase().includes(archiveFilter.toLowerCase()));

  return <main className={`game-root ${playing?"in-game":"in-menu"} ${preferences.reduceMotion?"reduce-motion":""}`}>
    <canvas ref={canvasRef} className="world-canvas" aria-label={`Lieu 3D explorable : ${level.name}`} onClick={capture}
      onPointerDown={e=>{if(playing&&!inputBlocked&&!locked&&e.pointerType!=="touch"){touchLook.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}}}
      onPointerMove={e=>{const t=touchLook.current;if(t&&t.id===e.pointerId&&!locked&&!inputBlocked){engine.current?.look((e.clientX-t.x)*preferences.sensitivity,(e.clientY-t.y)*preferences.sensitivity);touchLook.current={x:e.clientX,y:e.clientY,id:e.pointerId};}}}
      onPointerUp={()=>{touchLook.current=null;}} onPointerCancel={()=>{touchLook.current=null;}}/>
    <div className="cinematic-shade" aria-hidden="true"/><div className="grain" aria-hidden="true"/>

    {!active&&<>
      <header className="menu-header"><Brand/><nav><button className="text-button protocol-link" onClick={()=>openModal("help")}>LE PROTOCOLE <ArrowUpRight size={14}/></button><span className="header-rule"/><IconButton title={preferences.muted?"Activer le son":"Couper le son"} onClick={()=>{audio.current?.start();patchPref({muted:!preferences.muted});}}>{preferences.muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</IconButton><IconButton title="Plein écran" onClick={fullscreen}><Fullscreen size={18}/></IconButton></nav></header>
      <section className="title-section">
        <div className="chapter"><span className="pulse-dot"/> EXPÉRIENCE COOPÉRATIVE <span className="chapter-line"/> 03 LIEUX — UNE SEULE SORTIE</div>
        <h1>PARALLAXE<span>PROTOCOLE <em>9</em></span></h1>
        <p className="tagline">Vous êtes au même endroit.<br/><strong>Vous ne voyez pas la même chose.</strong></p>
        <div className="menu-locations" aria-label="Aperçu des lieux">{MISSION_LOCATIONS.map(location=><button key={location.id} aria-pressed={previewLevel===location.id} className={previewLevel===location.id?"selected":""} onClick={()=>setPreviewLevel(location.id)}><location.icon size={13}/><span>{location.name}</span></button>)}</div>
        <div className="title-actions">
          <button className="primary-action" onClick={()=>openModal("coop")}><span className="action-glyph"><Users size={20}/></span><span>Jouer en coopération<small>2 à 4 inspecteurs · salon privé</small></span><ArrowUpRight size={20}/></button>
          <button className="secondary-action" onClick={()=>openModal("start")}><Eye size={19}/><span>S’exercer seul<small>Deux perceptions, un inspecteur</small></span><ArrowRight size={17}/></button>
          {savedRun&&<button className="resume-link" disabled={!ready} onClick={()=>beginSolo(true)}><RotateCcw size={13}/> Reprendre l’inspection · {savedRun.streak}/9</button>}
          {savedSession&&<button className="resume-link" onClick={resumeSession}><Radio size={13}/> Retrouver le salon {savedSession.code}</button>}
        </div>
        <div className="menu-secondary"><button onClick={()=>openModal("archives")}><BookOpen size={15}/> Archives <span>{known.length.toString().padStart(2,"0")}</span></button><button onClick={()=>openModal("settings")}><Settings2 size={15}/> Paramètres</button></div>
      </section>
      <aside className="location-caption"><span className="caption-cross">+</span><div><small>{level.name.toUpperCase()}</small><p>{level.subtitle}</p><span>FRÉQUENCE 09 &nbsp; / &nbsp; LE SILENCE A UNE VOIX</span></div></aside>
      <footer className="menu-footer"><span><Headphones size={14}/> À JOUER AU CASQUE</span><span className="footer-center">OBSERVER. COMMUNIQUER. DOUTER.</span><span>ÉDITION JOUABLE <b>0.2.1</b><i className="status-light"/></span></footer>
    </>}

    {!ready&&!graphicsError&&<div className="loading-scene"><LoaderCircle className="spin" size={18}/> Initialisation de l’observatoire…</div>}
    {graphicsError&&!graphicsDismissed&&<section className="graphics-error" role="alert"><AlertTriangle/><h2>Le rendu 3D n’a pas pu démarrer.</h2><p>Ce jeu nécessite WebGL 2. Essayez un navigateur récent avec l’accélération graphique activée.</p><p>Les menus, le salon et le test du talkie restent accessibles. L’inspection 3D attend un rendu fonctionnel.</p><details><summary>Détail technique</summary>{graphicsError}</details><div className="graphics-actions"><button className="solid-button" onClick={()=>location.reload()}>Réessayer</button><button className="outline-button" onClick={()=>setGraphicsDismissed(true)}>Accéder aux menus</button></div></section>}
    {graphicsError&&graphicsDismissed&&<button className="graphics-notice" onClick={()=>setGraphicsDismissed(false)}><AlertTriangle size={13}/> Rendu 3D indisponible · détails</button>}

    {playing&&<>
      <header className="game-header"><div className="inspection-label"><span className="eyebrow">PROGRAMME PARALLAXE</span><strong>{phase==="reference"?"PASSAGE DE RÉFÉRENCE":"INSPECTION "+String(loop).padStart(2,"0")}</strong><span className="place-label">{level.name} · {missionMode==="campaign"?`Secteur ${(online?.stage??run?.stage??0)+1}/3`:"Inspection autonome"}</span></div><div className="progress-block"><div><span>PROTOCOLE DE SORTIE</span><b>{streak}<i> / 09</i></b></div><div className="progress-segments">{Array.from({length:9},(_,i)=><span key={i} className={i<streak?"complete":""}/>)}</div></div><div className="hud-right"><span className={`perception role-${currentSlot}`}><i/>{LETTERS[currentSlot]} <span>{online?self?.name:"PERCEPTION "+(slot===0?"ALPHA":"BÊTA")}</span></span><IconButton title="Pause et paramètres" onClick={()=>openModal("pause")}><Pause size={17}/></IconButton></div></header>
      {phase==="reference"&&<div className="reference-banner"><ShieldCheck size={16}/><span>Rien d’anormal ici. <b>Mémorisez les détails.</b></span><button onClick={()=>openModal("journal")}>Voir le protocole <ArrowRight size={14}/></button></div>}
      {phase==="inspect"&&<div className="inspection-hint"><span className="pulse-dot"/>{online?"Comparez vos observations avant de voter.":"Inspectez les deux perceptions avant de décider."}</div>}
      {!inputBlocked&&<div className={`reticle ${target?"has-target":""}`} aria-hidden="true"><i/><i/><i/><i/></div>}
      {!inputBlocked&&target&&<div className="target-label"><Key>E</Key><span>{target.id==="exit"?"Terminal de diagnostic":target.label}</span><small>{target.id==="exit"?"OUVRIR":"SIGNALER"}</small></div>}
      {!isTouch&&!locked&&!inputBlocked&&<button className="capture-prompt" onClick={capture}><Crosshair size={15}/> Cliquez dans le lieu pour regarder autour de vous</button>}
      <aside className="field-info"><span className="eyebrow">{online?"ÉQUIPE EN LIAISON":"ENTRAÎNEMENT SOLO"}</span>{online?<div className="team-list">{online.players.map(p=><div key={p.id} className={p.connected?"":"disconnected"}><span className={`role-dot role-${p.slot}`}/><span>{p.name}{p.id===self?.id?" (vous)":""}</span><small>{!p.connected?"ABSENT":p.talking?"PARLE":p.vote===null?"OBSERVE":p.vote?"ANOMALIE":"NORMAL"}</small></div>)}</div>:<><p>Un seul lieu. Deux observations.</p><button className="switch-perception" onClick={switchView}><Key>Tab</Key> Passer en perception {slot===0?"β":"α"}<ArrowRight size={14}/></button></>}
      <div className="strikes"><span>ERREURS</span>{Array.from({length:3},(_,i)=><i key={i} className={i<strikes?"used":""}/>)}<small>{(online?.difficulty??run?.difficulty)==="relaxed"?"SANS ÉCHEC FINAL":"3 = RUPTURE"}</small></div></aside>
      <div className="field-actions"><IconButton title="Carnet de référence (J)" onClick={()=>openModal("journal")}><BookOpen size={18}/></IconButton><IconButton title="Lampe torche (F)" active={torch} onClick={toggleTorch}><Flashlight size={18}/></IconButton><IconButton title="Talkie et communication (T)" onClick={()=>openModal("radio")}><Radio size={18}/></IconButton>{phase==="reference"?<button className="diagnostic-button" disabled={!!online&&!isHost||busy} onClick={nextRound}>{online&&!isHost?"L’hôte lance l’inspection":"Référence mémorisée"}<ArrowRight size={17}/></button>:<button className="diagnostic-button" onClick={()=>openModal("vote")} disabled={phase!=="inspect"}><Key>V</Key> Diagnostic <ArrowRight size={17}/></button>}</div>
      <div className="radio-hud">{online?<TalkButton compact enabled={!!radioStatus?.microphone&&!networkDown} talking={radioStatus?.talking??false} onTalk={setTalking}/>:<button className="radio-probe-shortcut" onClick={()=>openModal("radio")}><Radio size={14}/> Tester le talkie</button>}</div><div className="controls-line"><span><Key>ZQSD</Key> / <Key>WASD</Key> Se déplacer</span><span><Key>E</Key> Signaler</span><span><Key>F</Key> Lampe</span><span><Key>J</Key> Carnet</span><span><Key>T</Key> Talkie</span><span><Key>Échap</Key> Pause</span></div>
      {online&&online.pings.length>0&&<div className="ping-feed">{online.pings.slice(-2).map(p=><span key={p.id}><Radio size={12}/> {p.name} : repère « {p.target} »</span>)}</div>}
      {(networkDown||online?.paused)&&<div className="network-warning" role="status"><Radio size={15}/> {networkDown?"Liaison interrompue · reconnexion automatique. Attendez avant de voter.":"Un inspecteur manque à l’appel. Le diagnostic attend son retour."}</div>}
      {isTouch&&!inputBlocked&&<div className="touch-controls"><div className="touch-stick" role="application" aria-label="Joystick de déplacement" onPointerDown={e=>{joystickOrigin.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const o=joystickOrigin.current;if(!o||o.id!==e.pointerId)return;const x=Math.max(-38,Math.min(38,e.clientX-o.x));const y=Math.max(-38,Math.min(38,e.clientY-o.y));setTouchStick({x,y});touchMove.current={strafe:x/38,forward:-y/38};}} onPointerUp={()=>{joystickOrigin.current=null;touchMove.current={forward:0,strafe:0};setTouchStick({x:0,y:0});}} onPointerCancel={()=>{joystickOrigin.current=null;touchMove.current={forward:0,strafe:0};setTouchStick({x:0,y:0});}}><i style={{transform:`translate(${touchStick.x}px,${touchStick.y}px)`}}/></div><div className="touch-look" role="application" aria-label="Glissez pour regarder" onPointerDown={e=>{touchLook.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const o=touchLook.current;if(!o||o.id!==e.pointerId)return;engine.current?.look((e.clientX-o.x)*1.6*preferences.sensitivity,(e.clientY-o.y)*1.6*preferences.sensitivity);touchLook.current={x:e.clientX,y:e.clientY,id:e.pointerId};}} onPointerUp={()=>{touchLook.current=null;}} onPointerCancel={()=>{touchLook.current=null;}}><span>REGARDER</span></div><button className="touch-interact" onClick={interact}><Crosshair size={22}/></button></div>}
    </>}

    {online&&phase==="lobby"&&<section className="lobby-screen"><header><Brand/><button className="text-button" onClick={returnMenu}><ChevronLeft size={16}/> Quitter le salon</button></header><div className="lobby-content"><span className="eyebrow">LIAISON ÉTABLIE · {online.players.length} / 4</span><h1>L’équipe avant<br/>la réalité.</h1><p>Chaque inspecteur verra sa propre version du lieu.<br/>Gardez une ligne de communication ouverte.</p><div className="room-code"><span>CODE DU SALON</span><strong>{online.code}</strong><button title="Copier le code" aria-label="Copier le code" onClick={copyCode}><Copy size={18}/></button></div><div className="lobby-roster">{Array.from({length:4},(_,i)=>{const p=online.players.find(p=>p.slot===i);return <div className={p?"filled":""} key={i}><span>{LETTERS[i]}</span><div><strong>{p?.name??"En attente d’un inspecteur"}</strong><small>{p?p.id===online.hostId?"RESPONSABLE DU PROTOCOLE":"OBSERVATEUR":"EMPLACEMENT LIBRE"}</small></div>{p&&<Check size={17}/>}</div>;})}</div>{isHost?<button className="solid-button wide" disabled={!ready||online.players.filter(p=>p.connected).length<2||busy} onClick={()=>request("start")}>{busy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>} {!ready?"Rendu 3D nécessaire pour commencer":online.players.length<2?"En attente du deuxième inspecteur":"Entrer dans l’observatoire"}</button>:<p className="waiting-note"><LoaderCircle className="spin" size={15}/> Le responsable lancera le passage de référence.</p>}<button className="outline-button wide lobby-radio-button" onClick={()=>openModal("radio")}><Radio size={16}/> Préparer et tester mon talkie</button><p className="fine-print">Talkies intégrés : activez votre microphone, puis maintenez T pour parler. Les invités doivent avoir accès à cette édition du jeu.</p>{error&&<p className="error-line" role="alert">{error}</p>}</div><aside className="lobby-sidebar"><span className="eyebrow">RÈGLE N° 01</span><h2>Votre collègue<br/>ne ment pas.</h2><p>Si vous ne voyez pas la même chose, c’est le lieu qu’il faut remettre en question.</p><div className="signal-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></aside></section>}

    {roundFinished&&reveal&&<section className={`result-overlay ${reveal.correct?"result-good":"result-bad"}`}><div className="result-panel"><span className="eyebrow">{phase==="won"?"PROTOCOLE ACCOMPLI":phase==="lost"?"RUPTURE DE COHÉRENCE":`RAPPORT D’INSPECTION ${String(loop).padStart(2,"0")}`}</span><div className="result-symbol">{phase==="won"?<DoorOpen/>:reveal.correct?<Check/>:<X/>}</div><h2>{phase==="won"?"Vous êtes d’accord.\nLa sortie est réelle.":phase==="lost"?"Le lieu a gagné.\nPour cette fois.":reveal.correct?"Diagnostic confirmé.":"Diagnostic incorrect."}</h2><p className="result-explanation">{phase==="won"?"Neuf inspections validées. La porte du protocole s’ouvre enfin. Derrière vous, une voix demande si tout le monde est bien sorti.":phase==="lost"?"Trois ruptures ont effacé votre trace dans l’observatoire. Vos découvertes restent dans les archives. Une nouvelle équipe peut reprendre le protocole.":reveal.description}</p><div className="result-evidence"><span>{reveal.hasAnomaly?"ANOMALIE CONSTATÉE":"AUCUNE ANOMALIE"}</span><strong>{reveal.title}</strong>{reveal.observerNames?.length&&<small>Perçue par : {reveal.observerNames.join(", ")}</small>}</div><div className="result-metrics"><span><b>{streak}/9</b> INSPECTIONS CONFORMES</span><span><b>{strikes}</b> ERREUR{strikes>1?"S":""}</span></div>{phase==="won"||phase==="lost"?<button className="solid-button wide" onClick={returnMenu}>Retour à l’accueil <ArrowRight size={17}/></button>:<button className="solid-button wide" disabled={!!online&&!isHost||busy} onClick={nextRound}>{online&&!isHost?"Le responsable prépare le passage suivant":"Passage suivant"}<ArrowRight size={17}/></button>}{error&&<p className="error-line">{error}</p>}</div></section>}

    {modal!=="none"&&<div className="modal-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className={`modal-panel modal-${modal}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><span className="eyebrow">PARALLAXE / {modal==="settings"?"CONFIGURATION":"PROTOCOLE 09"}</span><IconButton title="Fermer" onClick={closeModal}><X size={19}/></IconButton></div>
      {modal==="start"&&<><h2 id="modal-title">Apprendre à douter.</h2><p className="modal-intro">Inspectez le lieu en solo, puis passez d’une perception à l’autre avec <Key>Tab</Key>. Une seule différence suffit pour signaler une anomalie.</p><MissionSelector value={mission} onChange={setMission}/><div className="mode-options"><button className={difficulty==="standard"?"selected":""} onClick={()=>setDifficulty("standard")}><span>01</span><strong>Protocole standard</strong><p>Trois erreurs terminent la session. La progression suit les règles du parcours choisi.</p></button><button className={difficulty==="relaxed"?"selected":""} onClick={()=>setDifficulty("relaxed")}><span>02</span><strong>Observation libre</strong><p>La même enquête, sans limite d’erreurs. Prenez le temps de comprendre chaque détail.</p></button></div><label className="field-label">GRAINE DE SESSION <span>facultatif · même graine, même séquence</span><input value={seed} onChange={e=>setSeed(e.target.value.slice(0,64))} placeholder="Laisser vide pour une nouvelle séquence"/></label><button className="solid-button wide" disabled={!ready} onClick={()=>beginSolo()}>Entrer dans l’observatoire <ArrowRight size={17}/></button></>}
      {modal==="coop"&&<><h2 id="modal-title">Ne restez pas seul.</h2><p className="modal-intro">Créez un salon, partagez son code et entrez ensemble dans l’observatoire. Chaque écran garde sa propre perception.</p><label className="field-label">VOTRE INDICATIF<input maxLength={24} value={name} onChange={e=>setName(e.target.value)} placeholder="Votre nom d’inspecteur"/></label><MissionSelector value={mission} onChange={setMission} compact/><div className="coop-columns"><div><h3>Créer une équipe</h3><label className="field-label">PROTOCOLE<select value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}><option value="standard">Standard · 3 erreurs maximum</option><option value="relaxed">Observation libre · erreurs illimitées</option></select></label><button className="solid-button wide" disabled={busy} onClick={()=>startNetwork(false)}>{busy?<LoaderCircle className="spin" size={16}/>:<Users size={16}/>} Créer le salon</button></div><div><h3>Rejoindre une équipe</h3><label className="field-label">CODE DU SALON<input className="code-input" maxLength={8} value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))} placeholder="EX. K7M3Q2"/></label><button className="outline-button wide" disabled={busy||joinCode.length<4} onClick={()=>startNetwork(true)}>Rejoindre <ArrowRight size={16}/></button></div></div><p className="fine-print"><Radio size={14}/> Voix au talkie, texte et repères partagés inclus. Le parcours est choisi par la personne qui crée le salon.</p></>}
      {modal==="help"&&<><h2 id="modal-title">Ne faites pas confiance<br/>à un seul regard.</h2><p className="modal-intro">L’observatoire teste votre capacité à construire une certitude ensemble.</p><ol className="protocol-steps"><li><span>01</span><div><h3>Mémorisez le lieu.</h3><p>Le premier passage est toujours normal. Repérez les portes, le portrait, l’horloge et le mobilier.</p></div></li><li><span>02</span><div><h3>Comparez vos perceptions.</h3><p>Décrivez des détails précis : position, forme, mouvement. Votre collègue peut voir quelque chose qui vous est invisible.</p></div></li><li><span>03</span><div><h3>Rendez un diagnostic commun.</h3><p>Anomalie si un seul inspecteur observe une altération. Aucune anomalie si tout concorde. Tous les votes doivent être identiques.</p></div></li><li><span>09</span><div><h3>Gagnez le droit de sortir.</h3><p>Campagne : trois validations dans chacun des trois lieux. Une erreur remet le secteur en cours à zéro. En lieu au choix, il faut neuf validations consécutives. Trois erreurs interrompent le protocole standard.</p></div></li></ol><div className="help-controls"><p><Key>ZQSD</Key> / <Key>WASD</Key> Se déplacer &nbsp; · &nbsp; Souris : regarder</p><p><Key>E</Key> Signaler &nbsp; <Key>V</Key> Diagnostic &nbsp; <Key>J</Key> Carnet &nbsp; <Key>F</Key> Lampe</p><p><Key>Tab</Key> Autre perception en solo &nbsp; <Key>Échap</Key> Pause</p><p><Key>T</Key> Maintenir pour parler au talkie, après activation du microphone.</p><p>Manette : A signaler, X diagnostic, Y lampe, LB talkie, View carnet, Menu pause. Joysticks pour marcher et regarder.</p><p>Sur écran tactile : joystick à gauche, regard à droite, boutons à l’écran.</p></div><button className="solid-button wide" onClick={closeModal}>Protocole compris <Check size={16}/></button></>}
      {modal==="settings"&&<><h2 id="modal-title">Votre perception.</h2><div className="setting-row"><div><h3>Volume général</h3><p>Ambiance, pas et signaux du protocole.</p></div><label><input type="range" min="0" max="1" step="0.01" value={preferences.volume} aria-label="Volume général" onChange={e=>{audio.current?.start();patchPref({volume:+e.target.value});}}/><span>{Math.round(preferences.volume*100)}%</span></label></div><div className="setting-row"><div><h3>Volume du talkie</h3><p>Voix reçues, parasites et test de calibration.</p></div><label><input type="range" min="0" max="1" step="0.01" value={preferences.radioVolume} aria-label="Volume du talkie" onChange={e=>patchPref({radioVolume:+e.target.value})}/><span>{Math.round(preferences.radioVolume*100)}%</span></label></div><div className="setting-row"><div><h3>Sensibilité du regard</h3><p>Souris, écran tactile et manette.</p></div><label><input type="range" min="0.35" max="2.5" step="0.05" value={preferences.sensitivity} aria-label="Sensibilité du regard" onChange={e=>patchPref({sensitivity:+e.target.value})}/><span>{preferences.sensitivity.toFixed(2)}</span></label></div><div className="setting-row"><div><h3>Qualité du rendu</h3><p>Réglez les ombres et la résolution.</p></div><select aria-label="Qualité graphique" value={preferences.quality} onChange={e=>patchPref({quality:e.target.value as Preferences['quality']})}><option value="low">Performance</option><option value="medium">Équilibré</option><option value="high">Haute fidélité</option></select></div><label className="toggle-row"><div><h3>Confort visuel</h3><p>Réduire les animations de l’interface et désactiver le sprint.</p></div><input type="checkbox" checked={preferences.reduceMotion} onChange={e=>patchPref({reduceMotion:e.target.checked})}/></label><label className="toggle-row"><div><h3>Mode silencieux</h3><p>Les relevés écrits de calibration permettent aussi de comparer les anomalies radio.</p></div><input type="checkbox" checked={preferences.muted} onChange={e=>patchPref({muted:e.target.checked})}/></label><p className="fine-print">Réglages enregistrés sur cet appareil. Le jeu ne contient pas de flash stroboscopique.</p><button className="outline-button wide" onClick={()=>patchPref(DEFAULTS)}>Réglages par défaut</button></>}
      {modal==="archives"&&<><h2 id="modal-title">Ce que le lieu a révélé.</h2><p className="modal-intro">{known.length} découverte{known.length>1?"s":""} sur {ANOMALIES.length} anomalies jouables. Les dossiers s’ouvrent après une inspection résolue.</p><div className="archive-toolbar"><input placeholder="Rechercher un dossier…" aria-label="Rechercher une anomalie" value={archiveFilter} onChange={e=>setArchiveFilter(e.target.value)}/><label><input type="checkbox" checked={spoilers} onChange={e=>setSpoilers(e.target.checked)}/> Afficher les spoilers</label></div><div className="archive-grid">{renderedAnomalies.map((a,i)=>{const unlocked=spoilers||known.includes(a.id);return <article className={unlocked?"unlocked":""} key={a.id}><span className="eyebrow">DOSSIER {String(i+1).padStart(3,"0")} {unlocked?<Eye size={14}/>:<EyeOff size={14}/>}</span><h3>{unlocked?a.title:"Observation inconnue"}</h3><p>{unlocked?a.description:"Poursuivez le protocole pour documenter cette altération."}</p>{unlocked&&<small>RÉFÉRENCE : {a.baseline}</small>}</article>;})}</div><div className="download-list"><a className="download-link" href="/downloads/PARALLAXE_Design_Complet.xlsx" download><Download size={15}/> Document de conception (.xlsx)</a>{!portable&&<a className="download-link" href="/downloads/PARALLAXE_Jeu_PC_LAN_v0.2.1.zip" download><Download size={15}/> Jeu PC / réseau local (.zip)</a>}<a className="download-link" href="/downloads/PARALLAXE_Sources_v0.2.1.zip" download><Download size={15}/> Sources complètes (.zip)</a></div></>}
      {modal==="journal"&&<><h2 id="modal-title">{level.name} · référence.</h2><p className="modal-intro">Le premier passage est votre référence. Une altération chez un seul inspecteur suffit à rendre le lieu anormal.</p><div className="baseline-list">{[...level.baseline.map((description,i)=>[`Repère ${i+1}`,description]),["Inspecteurs","Votre corps et les autres joueurs ont une tenue d’inspection. Les reflets suivent leurs mouvements ; aucune présence supplémentaire ne doit apparaître."],["Talkie",radioReferenceCaption],["Comparaison","Le code RELAIS change normalement entre deux passages, mais doit être identique pour tous dans un même passage."]].map(([title,description],i)=><article key={title}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>{notes.length>0&&<div className="notebook-notes"><h3>Vos repères pour ce passage</h3>{notes.map((note,i)=><p key={i}>{note}</p>)}</div>}{phase==="reference"&&<button className="solid-button wide" disabled={!!online&&!isHost||busy} onClick={nextRound}>{online&&!isHost?"Le responsable lance l’inspection":"J’ai mémorisé la référence"}<ArrowRight size={16}/></button>}</>}
      {modal==="vote"&&<><span className="diagnostic-kicker"><Radio size={17}/> TERMINAL DE DIAGNOSTIC</span><h2 id="modal-title">La réalité concorde-t-elle ?</h2><p className="modal-intro">{online?"Décrivez votre observation à l’équipe avant de voter. Un désaccord bloque la transition ; chacun peut modifier son vote.":"Avez-vous regardé les deux perceptions ? Une anomalie présente dans une seule version compte pour l’inspection entière."}</p><div className="vote-options"><button className={self?.vote===false?"selected":""} disabled={busy||phase!=="inspect"||networkDown} onClick={()=>vote(false)}><ShieldCheck size={30}/><h3>Aucune anomalie</h3><p>Nous avons tout comparé.<br/>Le lieu est conforme.</p><span>VALIDER LE PASSAGE <ArrowRight size={15}/></span></button><button className={`vote-danger ${self?.vote===true?"selected":""}`} disabled={busy||phase!=="inspect"||networkDown} onClick={()=>vote(true)}><Eye size={30}/><h3>Anomalie présente</h3><p>Au moins une perception<br/>révèle une altération.</p><span>SIGNALER L’ALTÉRATION <ArrowRight size={15}/></span></button></div>{online&&<div className="vote-roster">{online.players.map(p=><span key={p.id}>{LETTERS[p.slot]} {p.name} <b>{p.vote===null?"En réflexion":p.vote?"Anomalie":"Conforme"}</b></span>)}</div>}<p className="fine-print">{missionMode==="campaign"?"Un mauvais diagnostic remet les validations du secteur actuel à zéro. Les secteurs terminés restent acquis.":"Un mauvais diagnostic remet les neuf validations à zéro."}</p></>}
      {modal==="pause"&&<><h2 id="modal-title">Prenez un instant.</h2><p className="modal-intro">{online?"Votre équipe reste dans l’observatoire. La session réseau continue pendant ce menu.":"Votre inspection solo est sauvegardée sur cet appareil."}</p><div className="pause-actions"><button className="solid-button wide" onClick={closeModal}>Reprendre l’observation <ArrowRight size={16}/></button><button className="outline-button wide" onClick={()=>setModal("settings")}><Settings2 size={16}/> Paramètres</button><button className="outline-button wide" onClick={()=>setModal("help")}><CircleHelp size={16}/> Le protocole</button><button className="outline-button wide" onClick={()=>setModal("archives")}><BookOpen size={16}/> Archives d’anomalies</button>{confirmLeave?<div className="leave-confirm"><p>{online?"Quitter le salon et libérer votre place ?":"Revenir à l’accueil ? L’inspection reste enregistrée."}</p><button className="danger-button" onClick={returnMenu}>Confirmer le retour</button><button className="text-button" onClick={()=>setConfirmLeave(false)}>Rester</button></div>:<button className="text-button quit-button" onClick={()=>setConfirmLeave(true)}>Retour à l’accueil</button>}</div></>}
      {modal==="radio"&&<><h2 id="modal-title">Votre voix dans le noir.</h2><p className="modal-intro">Échangez des faits précis. Une interférence dans une seule perception peut faire partie de l’enquête ; une erreur de liaison est signalée séparément.</p><RadioPanel peerNames={Object.fromEntries((online?.players??[]).map(p=>[p.id,p.name]))} status={radioStatus} isOnline={!!online} pending={radioPending} caption={radioCaption} onEnable={enableMicrophone} onListen={listenRadio} onReconnect={reconnectRadio} onStop={stopRadio} onDisable={stopMicrophone} onTalk={setTalking} onProbe={probeRadio}/>{online&&<><div className="radio-messages" role="log" aria-live="polite">{!online?.messages.length&&<p className="empty-radio">Ligne ouverte. Aucun message pour le moment.</p>}{online?.messages.map(m=><article key={m.id}><b>{m.name}</b><p>{m.text}</p></article>)}</div><form className="radio-form" onSubmit={sendChat}><input autoFocus maxLength={280} aria-label="Message radio" placeholder="Ex. L’horloge tourne à l’envers chez moi." value={chat} onChange={e=>setChat(e.target.value)}/><button className="solid-button" disabled={busy||!chat.trim()} type="submit"><ArrowRight size={18}/><span className="sr-only">Envoyer</span></button></form><p className="fine-print">Les messages restent dans ce salon temporaire.</p></>}</>}
      {error&&<p className="error-line" role="alert"><AlertTriangle size={15}/>{error}</p>}
    </section></div>}
    {toast&&<div className="toast" role="status"><Radio size={15}/>{toast}</div>}
    {error&&modal==="none"&&phase!=="lobby"&&!roundFinished&&<div className="global-error" role="alert">{error}<button aria-label="Fermer l’erreur" onClick={()=>setError("")}><X size={15}/></button></div>}
  </main>;
}
