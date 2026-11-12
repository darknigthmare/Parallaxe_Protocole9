/** Device-local settings. Never includes identity, consent, room state or private clues. */
export const BINDING_ACTIONS = ['forward','backward','left','right','sprint','interact','stopListening','vote','journal','torch','switchView','talk'] as const;
export type BindingAction = typeof BINDING_ACTIONS[number];
export type KeyBindings = Record<BindingAction,string>;
export type KeyboardLayout = 'azerty'|'qwerty';
export const ACTION_LABELS:Record<BindingAction,string> = {
  forward:'Avancer',backward:'Reculer',left:'Aller à gauche',right:'Aller à droite',sprint:'Marcher vite',
  interact:'Inspecter / manipuler',stopListening:'Arrêter l’écoute',vote:'Diagnostic',journal:'Carnet',torch:'Lampe',switchView:'Autre perception (solo)',talk:'Maintenir le talkie',
};
export const DEFAULT_BINDINGS:Readonly<KeyBindings> = Object.freeze({forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',interact:'KeyE',stopListening:'KeyR',vote:'KeyV',journal:'KeyJ',torch:'KeyF',switchView:'Tab',talk:'KeyT'});
export type Preferences = {
  volume:number;radioVolume:number;radioMono:boolean;sensitivity:number;quality:'low'|'medium'|'high';muted:boolean;reduceMotion:boolean;
  fov:number;invertY:boolean;captionScale:number;keyboardLayout:KeyboardLayout;bindings:KeyBindings;
};
export const DEFAULT_PREFERENCES:Readonly<Preferences> = Object.freeze({volume:.38,radioVolume:.75,radioMono:false,sensitivity:1,quality:'medium',muted:false,reduceMotion:false,fov:65,invertY:false,captionScale:1,keyboardLayout:'azerty',bindings:DEFAULT_BINDINGS as KeyBindings});
function record(value:unknown):Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function number(value:unknown,fallback:number,min:number,max:number):number {return typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;}
function boolean(value:unknown,fallback:boolean):boolean {return typeof value==='boolean'?value:fallback;}
/** Escape and arrows remain reserved so pause and basic movement cannot be lost. */
export function validBinding(code:unknown):code is string {return typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Space|Tab|ShiftLeft|ShiftRight|Comma|Period|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/.test(code);}
export function sanitizeBindings(value:unknown):KeyBindings {
  const raw=record(value),result={...DEFAULT_BINDINGS};
  // Reject the whole damaged/custom map rather than silently moving an unrelated action.
  for(const action of BINDING_ACTIONS){if(raw[action]!==undefined){if(!validBinding(raw[action]))return {...DEFAULT_BINDINGS};result[action]=raw[action] as string;}}
  return new Set(Object.values(result)).size===BINDING_ACTIONS.length?result:{...DEFAULT_BINDINGS};
}
/** Migrate old saves, ignore unknown fields and reject non-finite/stringified numbers. */
export function normalizePreferences(value:unknown,systemReduceMotion=false):Preferences {
  const p=record(value),d=DEFAULT_PREFERENCES;
  return {volume:number(p.volume,d.volume,0,1),radioVolume:number(p.radioVolume,d.radioVolume,0,1),radioMono:boolean(p.radioMono,d.radioMono),sensitivity:number(p.sensitivity,d.sensitivity,.35,2.5),quality:p.quality==='low'||p.quality==='high'?p.quality:'medium',muted:boolean(p.muted,d.muted),reduceMotion:boolean(p.reduceMotion,systemReduceMotion),fov:number(p.fov,d.fov,50,95),invertY:boolean(p.invertY,d.invertY),captionScale:number(p.captionScale,d.captionScale,1,1.5),keyboardLayout:p.keyboardLayout==='qwerty'?'qwerty':'azerty',bindings:sanitizeBindings(p.bindings)};
}
export function assignBinding(bindings:KeyBindings,action:BindingAction,code:string):{bindings:KeyBindings;error:string} {
  if(!validBinding(code))return {bindings,error:'Touche réservée ou non reconnue. Échap annule ; les flèches restent disponibles.'};
  const conflict=BINDING_ACTIONS.find(other=>other!==action&&bindings[other]===code);
  if(conflict)return {bindings,error:`Cette touche est déjà utilisée : ${ACTION_LABELS[conflict]}. Choisissez une autre touche.`};
  return {bindings:{...bindings,[action]:code},error:''};
}
export function bindingLabel(code:string,layout:KeyboardLayout):string {
  const fixed:Record<string,string>={Space:'Espace',Tab:'Tab',ShiftLeft:'Maj gauche',ShiftRight:'Maj droite',Comma:',',Period:'.',Semicolon:layout==='azerty'?'M':';',Quote:'\'',BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'−',Equal:'=',Backquote:'`'};
  if(layout==='azerty'){const punctuation:Record<string,string>={Comma:';',Period:':',Quote:'ù',BracketLeft:'^',BracketRight:'$',Backslash:'*',Minus:')',Backquote:'²'};if(punctuation[code])return punctuation[code];}
  if(fixed[code])return fixed[code];
  const letter=code.replace(/^Key/,'');
  if(layout==='azerty'){const map:Record<string,string>={W:'Z',A:'Q',Q:'A',Z:'W',M:','};if(map[letter])return map[letter];}
  return code.startsWith('Numpad')?`Pavé ${code.slice(6)}`:code.startsWith('Digit')?code.slice(5):letter;
}
export function movementFromKeys(held:ReadonlySet<string>,bindings:KeyBindings) {
  return {forward:Number(held.has(bindings.forward)||held.has('ArrowUp'))-Number(held.has(bindings.backward)||held.has('ArrowDown')),
    strafe:Number(held.has(bindings.right)||held.has('ArrowRight'))-Number(held.has(bindings.left)||held.has('ArrowLeft')),sprint:held.has(bindings.sprint)};
}
export type KeyboardSample = {type:string;code:string;repeat?:boolean;ctrlKey?:boolean;altKey?:boolean;metaKey?:boolean;isComposing?:boolean;typing?:boolean};
export type KeyboardContext = {playing:boolean;blocked:boolean;focused:boolean;radioInput:boolean};
export type KeyboardActions = {pause:()=>void;talk:(on:boolean)=>void;interact:()=>void;stopListening:()=>void;vote:()=>void;journal:()=>void;torch:()=>void;switchView:()=>void};
/** Shared by the real callback and tests: no repeated press after blur/menu/remap. */
export function handleGameKey(e:KeyboardSample,held:Set<string>,s:KeyboardContext,b:KeyBindings,a:KeyboardActions):boolean {
  if(e.type==='keyup'){
    const wasHeld=held.delete(e.code);
    if(e.code===b.talk&&wasHeld)a.talk(false);
    return wasHeld&&!e.typing;
  }
  if(e.code==='Escape'&&s.playing&&s.focused&&!e.isComposing&&!e.ctrlKey&&!e.altKey&&!e.metaKey){if(!e.repeat)a.pause();return true;}
  if(e.typing||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||!s.focused){
    if(held.has(b.talk))a.talk(false);
    held.clear();return false;
  }
  const action=BINDING_ACTIONS.find(key=>b[key]===e.code);
  const movement=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)||['forward','backward','left','right','sprint'].includes(action??'');
  const allowed=action==='talk'?s.radioInput:s.playing&&!s.blocked;
  if(!allowed||(!action&&!movement))return false;
  if(e.repeat||held.has(e.code))return true;
  held.add(e.code);
  if(action==='talk')a.talk(true);
  else if(action&&!movement)a[action as keyof Omit<KeyboardActions,'pause'|'talk'>]();
  return true;
}
