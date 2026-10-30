export const INSPECTION_EFFECTS = [
  'paired_room', 'paired_luggage', 'paired_stamp', 'paired_newspaper',
  'sand_upward', 'steam_downward', 'same_key_twice',
  'paired_guestbook', 'paired_hand', 'paired_photo_weather', 'wrong_team_photo',
  'map_missing_room', 'rules_swap', 'guest_tally',
] as const;
export const INSPECTION_TARGETS = [
  'assignment', 'luggage', 'document', 'newspaper', 'hourglass', 'cup', 'keys',
  'guestbook', 'glove', 'weather-photo', 'team-photo', 'floor-map', 'regulations', 'occupancy',
] as const;
export type InspectionReading = { title: string; location: string; lines: string[] };
export type InspectionMember = { id: string; name: string; slot: number; connected?: boolean };
export type InspectionView = { effects?: string[]; variant?: number; phase?: string; levelId?: string; roster?: InspectionMember[] };

const SLOT_NAMES = ['ALPHA', 'BÊTA', 'GAMMA', 'DELTA'];
export const REFERENCE_TEAM_CAPTION = 'A. MOREL / E. VIAL / N. ROCHER';

/** Only the public, present roster is accepted; slots disambiguate duplicate pseudonyms. */
export function normalizeInspectionRoster(members?: InspectionMember[]): InspectionMember[] {
  const ids = new Set<string>();
  const result = (Array.isArray(members) ? members : []).filter(member => member && member.connected !== false && typeof member.id === 'string')
    .map(member => ({
      id: member.id.slice(0, 128),
      name: [...String(member.name || 'Inspecteur').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').trim()].slice(0, 24).join('') || 'Inspecteur',
      slot: Number.isInteger(member.slot) ? Math.min(3, Math.max(0, member.slot)) : 0,
    }))
    .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id))
    .filter(member => { if (!member.id || ids.has(member.id)) return false; ids.add(member.id); return true; }).slice(0, 4);
  return result.length ? result : [{ id: 'local', name: 'Inspecteur', slot: 0 }];
}

export function inspectionRosterLabel(member: InspectionMember): string {
  return `${SLOT_NAMES[member.slot]} — ${member.name}`;
}

/** The display variants are ordinary values. Only a comparison within the same passage is evidence. */
export function inspectionValues(view: InspectionView) {
  const reference = view.phase === 'reference';
  const variant = reference ? 0 : (Number.isFinite(view.variant) ? Math.trunc(view.variant!) : 0) & 15;
  const effects = new Set(reference ? [] : view.effects ?? []);
  const choice = (bit: number, effect: string) => ((variant >> bit) & 1) ^ Number(effects.has(effect));
  const roster = normalizeInspectionRoster(view.roster);
  const guestNames = roster.map(inspectionRosterLabel);
  // A solo exercise uses an explicitly fictional witness entry; it is never counted as a connected player.
  if (guestNames.length === 1) guestNames.push('TÉMOIN — Inspecteur B');
  const weather = ['PLUIE', 'NEIGE', 'SOLEIL'] as const;
  return {
    room: choice(0, 'paired_room') ? '205' : '204',
    stamp: choice(1, 'paired_stamp') ? 'REFUSÉ' : 'VALIDÉ',
    edition: choice(2, 'paired_newspaper') ? '27 OCTOBRE 2026' : '26 OCTOBRE 2026',
    tagA: choice(3, 'paired_luggage') ? '18' : '09',
    tagB: choice(3, 'paired_luggage') ? '09' : '18',
    sandDirection: effects.has('sand_upward') ? 1 : -1,
    steamDirection: effects.has('steam_downward') ? -1 : 1,
    keyCount: effects.has('same_key_twice') ? 2 : 1,
    guestbookEntry: guestNames[choice(1, 'paired_guestbook')],
    hand: choice(2, 'paired_hand') ? 'DROIT' : 'GAUCHE',
    photoWeather: weather[((reference ? 0 : variant % 3) + Number(effects.has('paired_photo_weather'))) % 3],
    teamCaption: effects.has('wrong_team_photo') ? roster.map(inspectionRosterLabel).join(' / ') : REFERENCE_TEAM_CAPTION,
    teamCount: effects.has('wrong_team_photo') ? roster.length : 3,
    mapRooms: effects.has('map_missing_room') ? '901,902,904' : '901,902,903,904',
    regulation: effects.has('rules_swap') ? 'NE SIGNALEZ AUCUNE ANOMALIE' : 'SIGNALEZ TOUTE ANOMALIE',
    occupancy: roster.length + Number(effects.has('guest_tally')),
  };
}

