/** Local listening evidence. No microphone, room answer, remote voice or shared mutable state. */
export type AcousticKind = 'rain' | 'knock3' | 'knock4' | 'breath' | 'melody' | 'melody-held' | 'held-note';
export type AcousticFocus = 'rain' | 'door' | 'phone' | 'music-box';
export type AcousticView = { phase?: string; loop?: number; levelId?: string; effects?: readonly string[]; knockCount?: 0 | 3 | 4 };
export type AcousticPose = { x: number; y?: number; z: number; yaw?: number; pitch?: number };
export type AcousticVoice = { id: string; kind: AcousticKind; offset: number; loop: boolean; position: readonly [number, number, number]; gain: number };
export type AcousticFrame = { key: string; voices: AcousticVoice[]; caption: string; phoneLifted: boolean; musicPlaying: boolean; musicAngle: number; knockPulse: number; focus: AcousticFocus; active: boolean };
export const ACOUSTIC_EFFECTS = ['paired_knocks', 'telephone_breath', 'music_one_note', 'rain_inside'] as const;
export const ACOUSTIC_PERIOD = 12;
export const MELODY_PERIOD = 8;
export const ACOUSTIC_ANCHORS = {
  window: [-3.40, 2.20, -12.25], ceiling: [0, 3.25, 2.65],
  door: [-3.40, 1.40, 0], phone: [2.56, 1.30, 7.65], 'music-box': [-3.30, 1.20, -10.10],
} as const;
const melodyNames = ['DO', 'MI', 'SOL', 'RÉ', 'FA', 'LA', 'SOL', 'DO AIGU'];

export function createAcousticState() {
  let key = '', phase = 'menu', level = 'hotel', loop = 0, effects = new Set<string>();
  let time = 0, knocks: 0 | 3 | 4 = 0, knockStart = 0;
  let phoneStart: number | null = null, musicStart: number | null = null, indoorRain = false, active = false;
  let focus: AcousticFocus = 'rain';
  function setView(view: AcousticView) {
    phase = view.phase ?? phase; level = view.levelId ?? level;
    loop = Number.isSafeInteger(view.loop) && view.loop! >= 0 ? view.loop! : loop;
    const nextKey = `${level}:${loop}:${['reference', 'menu', 'lobby'].includes(phase) ? phase : 'round'}`;
    if (key !== nextKey) { key = nextKey; time = 0; knockStart = 0; phoneStart = musicStart = null; indoorRain = false; focus = 'rain'; }
    const canHaveEffect = level === 'hotel' && !['reference', 'menu', 'lobby'].includes(phase);
    effects = new Set(canHaveEffect ? view.effects ?? [] : []);
    knocks = canHaveEffect && (view.knockCount === 3 || view.knockCount === 4) ? view.knockCount : 0;
    // Only the recipient's count is used. No inference from another observer or network failures.
    if (level !== 'hotel' || !['reference', 'inspect'].includes(phase)) active = false;
  }
  function update(dt: number, pose: AcousticPose, enabled = true) {
    active = enabled && level === 'hotel' && ['reference', 'inspect'].includes(phase);
    if (!active) return;
    const seconds = Number.isFinite(dt) ? Math.min(.25, Math.max(0, dt)) : 0;
    time += seconds;
    if (effects.has('rain_inside') && Number.isFinite(pose.x) && Number.isFinite(pose.z)
      && Math.hypot(pose.x, pose.z - 2.65) <= 1.75) indoorRain = true;
  }
  function activate(target: AcousticFocus) {
    if (!active) return false;
    focus = target;
    if (target === 'door') knockStart = time;
    if (target === 'phone') phoneStart = time;
    if (target === 'music-box') musicStart = time;
    return true;
  }
  function stop() { phoneStart = musicStart = null; focus = 'rain'; }
  function snapshot(): AcousticFrame {
    const voices: AcousticVoice[] = [];
    const inside = effects.has('rain_inside') && indoorRain;
    const origin = inside ? 'plafond du salon' : 'fenêtre sur la cour';
    let caption = `Pluie — provenance : ${origin}.`;
    const phoneAge = phoneStart === null ? 0 : time - phoneStart;
    const musicAge = musicStart === null ? 0 : time - musicStart;
    const knockAge = (time - knockStart) % ACOUSTIC_PERIOD;
    let knockPulse = 0, heard = 0;
    for (let i = 0; i < knocks; i++) {
      const beat = 1 + i * .7;
      if (knockAge + 1e-8 >= beat) heard++;
      if (knockAge >= beat && knockAge < beat + .15) knockPulse = 1 - (knockAge - beat) / .15;
    }
    if (active) {
      voices.push({ id: 'rain', kind: 'rain', offset: time % 4, loop: true, position: inside ? ACOUSTIC_ANCHORS.ceiling : ACOUSTIC_ANCHORS.window, gain: .22 });
      if (knocks) voices.push({ id: 'door', kind: knocks === 3 ? 'knock3' : 'knock4', offset: knockAge, loop: true, position: ACOUSTIC_ANCHORS.door, gain: .65 });
      if (phoneStart !== null && effects.has('telephone_breath')) voices.push({ id: 'phone', kind: 'breath', offset: phoneAge % 8, loop: true, position: ACOUSTIC_ANCHORS.phone, gain: .38 });
      if (musicStart !== null) {
        const held = effects.has('music_one_note');
        voices.push({ id: 'music-box', kind: held && musicAge >= MELODY_PERIOD ? 'held-note' : held ? 'melody-held' : 'melody',
          offset: held && musicAge >= MELODY_PERIOD ? (musicAge - MELODY_PERIOD) % 2 : musicAge % MELODY_PERIOD,
          loop: !held || musicAge >= MELODY_PERIOD, position: ACOUSTIC_ANCHORS['music-box'], gain: .38 });
      }
    }
    if (focus === 'door' || (knocks && focus === 'rain')) caption = knocks
      ? `Porte 903 — ${heard} coup${heard > 1 ? 's' : ''} depuis le début du cycle ; prochain cycle dans ${Math.max(1, Math.ceil(12 - knockAge))} s.`
      : 'Porte 903 — aucun coup entendu.';
    if (focus === 'phone') caption = effects.has('telephone_breath') && phoneStart !== null
      ? `Combiné — respiration lente : ${phoneAge % 8 < 3.2 ? 'inspiration' : phoneAge % 8 < 3.8 ? 'pause' : 'expiration'}.`
      : 'Combiné décroché — silence dans le fil.';
    if (focus === 'music-box' && musicStart !== null) {
      const retained = effects.has('music_one_note') && musicAge >= 5.6;
      const step = Math.floor((musicAge % MELODY_PERIOD) / .7);
      caption = retained ? 'Boîte à musique — DO AIGU maintenu après la fin de la mélodie.'
        : step < 8 ? `Boîte à musique — note ${step + 1}/8 : ${melodyNames[step]}.`
        : 'Boîte à musique — silence entre les deux cycles.';
    }
    return { key, voices, caption: level === 'hotel' && ['reference', 'inspect'].includes(phase) ? caption : '',
      phoneLifted: phoneStart !== null, musicPlaying: musicStart !== null,
      musicAngle: musicStart === null ? 0 : musicAge * .8, knockPulse, focus, active };
  }
  return { setView, update, activate, stop, snapshot };
}
