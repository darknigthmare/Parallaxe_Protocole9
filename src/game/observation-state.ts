/** Pure, per-observer state. No networking, hidden answer or microphone access. */
export type StarMask = 'all' | 'left' | 'right';
export type ObservationView = { phase?: string; loop?: number; levelId?: string; effects?: readonly string[]; starMask?: StarMask };
export type ObservationPose = { x: number; z: number };
export const OBSERVATION_EFFECTS = ['paired_stars', 'photo_age', 'stair_wrong_shadow', 'ceiling_walker'] as const;
export const OBSERVATION_TARGETS = ['stars', 'aged-photo', 'landing', 'ceiling'] as const;
export const STAR_POSITIONS = [[-.48, .22], [0, .30], [.48, .20], [-.43, -.20], [0, -.10], [.44, -.23]] as const;
export function starIndices(mask: StarMask): readonly number[] {
  return mask === 'left' ? [0, 1, 3, 4] : mask === 'right' ? [1, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
}

export function createObservationState() {
  let key = '', phase = 'menu', level = 'hotel', effects = new Set<string>(), mask: StarMask = 'all';
  let dwell = 0, age = 0, crossed = false, walkTime = 0;
  function setView(view: ObservationView) {
    const nextPhase = view.phase ?? phase;
    const nextLevel = view.levelId ?? level;
    // Solo A/B changes must not rewind a portrait which already aged in this passage.
    const nextKey = `${nextLevel}:${Number.isSafeInteger(view.loop) ? view.loop : 0}:${['reference', 'menu', 'lobby'].includes(nextPhase) ? nextPhase : 'round'}`;
    if (key !== nextKey) { key = nextKey; dwell = 0; age = 0; crossed = false; walkTime = 0; }
    level = nextLevel; phase = nextPhase;
    const inspectable = level === 'hotel' && !['reference', 'menu', 'lobby'].includes(phase);
    effects = new Set(inspectable ? view.effects ?? [] : []);
    mask = !inspectable ? 'all' : view.starMask === 'left' || view.starMask === 'right' ? view.starMask : effects.has('paired_stars') ? 'left' : 'all';
  }
  function update(dt: number, pose: ObservationPose, active = true) {
    if (!active || level !== 'hotel' || phase !== 'inspect') return;
    const seconds = Number.isFinite(dt) ? Math.min(.25, Math.max(0, dt)) : 0;
    const validPose = Number.isFinite(pose.x) && Number.isFinite(pose.z);
    if (effects.has('photo_age') && validPose && Math.hypot(pose.x + 3.45, pose.z + 14.2) <= 2.8) {
      dwell += seconds;
      if (dwell > 10) age = Math.max(age, Math.min(1, (dwell - 10) / 12));
    }
    if (effects.has('ceiling_walker')) {
      if (validPose && pose.z <= -3.05) crossed = true;
      if (crossed) walkTime += seconds;
    }
  }
  function snapshot() {
    return {
      starIndices: [...starIndices(mask)],
      photoAge: effects.has('photo_age') ? age : 0,
      stairShadow: effects.has('stair_wrong_shadow'),
      walkerVisible: effects.has('ceiling_walker') && crossed,
      walkerTime: walkTime,
    };
  }
  return { setView, update, snapshot };
}
