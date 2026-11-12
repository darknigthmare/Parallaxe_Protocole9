import type { AcousticVoice } from './acoustic-state';
/** Public intent only. The private delay/pose is never part of an interaction packet. */
export type PropTarget = 'bell' | 'vase' | 'witness-door' | 'listening-mannequin' | 'lift' | 'service-radio' | 'observatory-shutters';
export type PropEvent = { id: string; target: PropTarget; at: number; sequence: number; actorId: string; x: number; z: number };
export type TemporalView = { phase?: string; loop?: number; levelId?: string; effects?: readonly string[]; contextKey?: string };
export const TEMPORAL_EFFECTS = ['bell_after_departure', 'flower_afterimage', 'door_future_shadow', 'mannequin_turns', 'elevator_count', 'visitor_one_frame'] as const;
export const PROP_TARGETS: readonly PropTarget[] = ['bell', 'vase', 'witness-door', 'listening-mannequin', 'lift', 'service-radio', 'observatory-shutters'];
export const PROP_ANCHORS = { bell: [1.95, 1.23, 7.95], vase: [-3.30, 1.15, -4.10], 'witness-door': [3.22, 1.20, 11.10], 'listening-mannequin': [3.20, 1.20, -14.00], lift: [-2.45, 1.20, -15.65], 'service-radio':[-3.20,1.35,7.35], 'observatory-shutters':[-3.35,1.23,-4.45] } as const;
export const PROP_COOLDOWN: Record<PropTarget, number> = { bell: 8, vase: 4, 'witness-door': 8, 'listening-mannequin': 2, lift: 14, 'service-radio':12, 'observatory-shutters':3 };
const smooth = (n: number) => { n = Math.min(1, Math.max(0, n)); return n * n * (3 - 2 * n); };
const doorProgress = (t: number) => t < 0 ? 0 : t < 1 ? smooth(t) : t < 3 ? 1 : t < 4 ? 1 - smooth(t - 3) : 0;
const normalHeadYaw = Math.atan2(-3.475 - 3.20, -12.34 + 14);
export function isPropTarget(target: unknown): target is PropTarget { return typeof target === 'string' && PROP_TARGETS.includes(target as PropTarget); }

export function createTemporalState() {
  let key = '', phase = 'menu', level = 'hotel', effects = new Set<string>();
  let seconds = 0, remote = false, lastServer = -1, active = false, serial = 0;
  let focus: PropTarget | null = null;
  const events = new Map<PropTarget, PropEvent>();
  function setView(view: TemporalView) {
    phase = view.phase ?? phase; level = view.levelId ?? level;
    const next = `${view.contextKey ?? ''}:${level}:${view.loop ?? 0}:${['reference','menu','lobby'].includes(phase) ? phase : 'round'}`;
    if (key !== next) { key = next; seconds = 0; lastServer = -1; events.clear(); focus = null; }
    effects = new Set(level === 'hotel' && !['reference','menu','lobby'].includes(phase) ? view.effects ?? [] : []);
    if (!['hotel','observatory'].includes(level) || !['reference','inspect'].includes(phase)) active = false;
  }
  function sync(incoming: readonly PropEvent[] | null, serverTime?: number) {
    if (incoming === null) { if (remote) { events.clear(); seconds = 0; lastServer = -1; focus = null; } remote = false; return; }
    remote = true;
    if (!Number.isSafeInteger(serverTime) || serverTime! < 0 || serverTime! < lastServer) return;
    if (serverTime! > lastServer) { seconds = Math.max(seconds, serverTime! / 1000); lastServer = serverTime!; }
    // At most one latest, whitelisted intent per prop. Repeated polls never replay it.
    const fresh = new Map<PropTarget, PropEvent>();
    for (const event of incoming.slice(-PROP_TARGETS.length)) {
      if (!event || !isPropTarget(event.target) || typeof event.id !== 'string' || event.id.length > 96
        || (event.target==='observatory-shutters')!==(level==='observatory')
        || !Number.isFinite(event.at) || event.at < 0 || event.at > serverTime! + 1000
        || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || event.sequence > 1_000_000
        || !Number.isFinite(event.x) || !Number.isFinite(event.z)) continue;
      const old = events.get(event.target);
      if (!old || old.id !== event.id) focus = event.target;
      fresh.set(event.target, { ...event });
    }
    events.clear(); for (const [target,event] of fresh) events.set(target,event);
  }
  function update(dt: number, enabled = true) {
    active = enabled && ['hotel','observatory'].includes(level) && ['reference','inspect'].includes(phase);
    // Solo freezes during a reading. Shared public actions keep one server timeline;
    // their audio is still immediately silent in a menu and never bursts on return.
    if (active || remote && ['hotel','observatory'].includes(level) && ['reference','inspect'].includes(phase)) {
      seconds += Number.isFinite(dt) ? Math.min(.25, Math.max(0,dt)) : 0;
    }
  }
  function activate(target: PropTarget, pose: {x: number; z: number}) {
    if (!active || remote || !isPropTarget(target) || (target==='observatory-shutters')!==(level==='observatory') || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return false;
    const old = events.get(target);
    if (old && seconds - old.at/1000 < PROP_COOLDOWN[target]) { focus = target; return false; }
    events.set(target,{id:`solo-${++serial}`,target,at:seconds*1000,sequence:(old?.sequence ?? 0)+1,actorId:'training',x:pose.x,z:pose.z});
    focus = target; return true;
  }
  function snapshot() {
    const age = (target: PropTarget) => { const e=events.get(target); return e ? seconds-e.at/1000 : -Infinity; };
    const bellAge = age('bell'), vaseAge = age('vase'), doorAge = age('witness-door'), headAge = age('listening-mannequin');
    const bellDelay = effects.has('bell_after_departure') ? 5 : 0;
    const audibleAge = bellAge - bellDelay;
    const voices: AcousticVoice[] = [];
    if (active && audibleAge >= -1e-8 && audibleAge < 1.8) voices.push({id:`bell-${events.get('bell')!.id}`,kind:'bell',offset:Math.max(0,audibleAge),loop:false,position:PROP_ANCHORS.bell,gain:.48});
    const vaseEvent=events.get('vase');
    const previous = vaseEvent ? (vaseEvent.sequence-1) % 4 * Math.PI/2 : 0;
    const vaseYaw = previous + (vaseEvent ? smooth(vaseAge/.8)*Math.PI/2 : 0);
    const flowerYaw = previous + (vaseEvent ? smooth((vaseAge-(effects.has('flower_afterimage')?2:0))/.8)*Math.PI/2 : 0);
    const door = doorProgress(doorAge-2), shadow = doorProgress(doorAge-(effects.has('door_future_shadow')?0:2));
    const headEvent = events.get('listening-mannequin');
    if(active&&headEvent&&headAge>=0&&headAge<.6)voices.push({id:`call-${headEvent.id}`,kind:'call',offset:headAge,loop:false,position:[headEvent.x,1.67,headEvent.z],gain:.35});
    const difference = headEvent ? Math.atan2(Math.sin(Math.atan2(headEvent.x-3.20,headEvent.z+14)-normalHeadYaw), Math.cos(Math.atan2(headEvent.x-3.20,headEvent.z+14)-normalHeadYaw)) : 0;
    const headYaw = effects.has('mannequin_turns') && headEvent ? Math.max(-1.3,Math.min(1.3,difference))*smooth(headAge/.8) : 0;
    // The shaft never moves and 09 never changes. Only the personal sound count
    // and the persistent passenger differ; a late client sees the current opening.
    const liftEvent = events.get('lift'), liftAge = age('lift');
    const liftOpening = !liftEvent ? 0 : liftEvent.sequence>1&&liftAge<.35 ? 1-smooth(liftAge/.35) : smooth((liftAge-1)/1.4);
    const liftCount = liftEvent && liftAge >= .4
      ? Math.min(effects.has('elevator_count') ? 9 : 1, Math.floor((liftAge - .4 + 1e-8) / .8) + 1) : 0;
    const liftBeat = Math.floor((liftAge - .4 + 1e-8) / .8);
    const liftBeatAge = liftAge - .4 - liftBeat * .8;
    if (active && liftEvent && liftBeat >= 0 && liftBeat < (effects.has('elevator_count') ? 9 : 1)
      && liftBeatAge >= -1e-8 && liftBeatAge < .65) voices.push({
        id:`lift-${liftEvent.id}-${liftBeat}`,kind:'lift-chime',offset:Math.max(0,liftBeatAge),loop:false,
        position:PROP_ANCHORS.lift,gain:.45});
    // Never a one-frame clue: occupant stays in the doorway until the next call
    // (14 s minimum cooldown) or the next passage; changing observer hides it only.
    const liftVisitor = effects.has('visitor_one_frame') && !!liftEvent && (liftAge >= 1.8 || liftEvent.sequence>1&&liftAge<.35);
    const liftVisitorProgress = liftVisitor ? liftAge<.35 ? 1 : smooth((liftAge-1.8)/1.2) : 0;
    const shutterEvent=events.get('observatory-shutters'),shutterAge=age('observatory-shutters');
    const shutterOpening=!shutterEvent?0:shutterEvent.sequence%2?smooth(shutterAge/1.5):1-smooth(shutterAge/1.5);
    let caption = '';
    if (focus === 'bell') caption = bellAge < 0 ? 'Cloche — contact partagé en préparation.' : audibleAge < 0 ? `Cloche — contact effectué ; silence depuis ${Math.floor(bellAge)} s.` : `Cloche — sonnerie ${bellDelay === 0 ? 'au contact' : '5 s après le contact'}.`;
    if (focus === 'vase') caption = `Vase — repère ${Math.round(vaseYaw*180/Math.PI)%360}° ; fleur ${Math.round(flowerYaw*180/Math.PI)%360}°. E tourne d’un quart de tour.`;
    if (focus === 'witness-door') caption = `Porte témoin — battant ${Math.round(door*90)}° ; ombre ${Math.round(shadow*90)}°. Ouverture volontaire temporisée.`;
    if (focus === 'listening-mannequin') caption = `Vitrine — tête ${Math.abs(headYaw)<.02?'orientée vers la fenêtre':`tournée de ${Math.round(Math.abs(headYaw)*180/Math.PI)}° vers le dernier signal`}. Message texte ou E pour appeler.`;
    if (focus === 'lift') caption = `Ascenseur — ÉTAGE 09 fixe ; ${liftCount} sonnerie${liftCount>1?'s':''} depuis l’appel ; portes ${liftOpening>=.999?'ouvertes':liftOpening>0?'en ouverture':'fermées'}${liftOpening>=.45 ? liftVisitor?' ; une silhouette dans l’encadrement.':' ; cabine vide.':'.'}`;
    if(focus==='observatory-shutters')caption=`Baie O9 — volets ${Math.round(shutterOpening*100)} % ouverts. Examinez la baie pour comparer votre horizon.`;
    return {shutterOpening,key,active,now:seconds,voices,caption:['hotel','observatory'].includes(level)&&['reference','inspect'].includes(phase)?caption:'',
      bellPress:bellAge>=0&&bellAge<.2?Math.sin(bellAge/.2*Math.PI):0,vaseYaw,flowerYaw,door,shadow,headYaw,normalHeadYaw,
      liftOpening,liftCount,liftVisitor,liftVisitorProgress,
      focus,events:[...events.values()].map(e=>({...e}))};
  }
  return {setView,sync,update,activate,snapshot,clearFocus(){focus=null;},focus(target:PropTarget){if(isPropTarget(target))focus=target;}};
}
