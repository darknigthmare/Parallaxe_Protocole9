"use client";

import { ArrowRight, Building2, TrainFront, Hospital, House } from "lucide-react";
import { LEVEL_ORDER, type LevelId } from "@/src/game/levels";

export type MissionChoice = { mode: "campaign" | "single"; levelId: LevelId };

export const MISSION_LOCATIONS = [
  { id: "hotel" as const, index: "01", name: "Saint-Clair", subtitle: "L’hôtel sans neuvième étage", detail: "Bois sombre, réception silencieuse et reflets trop familiers.", icon: Building2 },
  { id: "metro" as const, index: "02", name: "Terminus 09", subtitle: "Le dernier quai", detail: "Quai vide, rails parallèles et tunnel sans départ.", icon: TrainFront },
  { id: "clinic" as const, index: "03", name: "Aile blanche", subtitle: "La clinique de nuit", detail: "Poste de soins, rideaux d’isolement et lits sous surveillance.", icon: Hospital },
  { id: "cabin" as const, index: "04", name: "Chalet de service", subtitle: "Le module témoin", detail: "Une table, une tasse, un carnet et un foyer froid dans un chalet de bois assemblé sous un hangar.", icon: House },
];

export function MissionSelector({ value, onChange, compact = false }: {
  value: MissionChoice; onChange: (value: MissionChoice) => void; compact?: boolean;
}) {
  return <fieldset className={`mission-selector ${compact ? "compact" : ""}`}>
    <legend>VOTRE PARCOURS</legend>
    <div className="mission-modes">
      <button type="button" aria-pressed={value.mode === "campaign"} className={value.mode === "campaign" ? "selected" : ""} onClick={() => onChange({ mode: "campaign", levelId: "hotel" })}>
        <strong>La traversée</strong><span>3 lieux · 3 validations par lieu</span>
      </button>
      <button type="button" aria-pressed={value.mode === "single"} className={value.mode === "single" ? "selected" : ""} onClick={() => onChange({ ...value, mode: "single" })}>
        <strong>Lieu au choix</strong><span>9 validations consécutives</span>
      </button>
    </div>
    {value.mode === "campaign" ? <div className="campaign-route" aria-label="Parcours de la campagne">
      {MISSION_LOCATIONS.filter(location => LEVEL_ORDER.includes(location.id)).map((location, index) => <div key={location.id}><location.icon size={16}/><span><small>{location.index}</small>{location.name}</span>{index < LEVEL_ORDER.length - 1 && <ArrowRight size={13}/>}</div>)}
    </div> : <div className="location-choices">
      {MISSION_LOCATIONS.map(location => <button type="button" key={location.id} className={value.levelId === location.id ? "selected" : ""} aria-pressed={value.levelId === location.id} onClick={() => onChange({ mode: "single", levelId: location.id })}>
        <location.icon size={22}/><small>SECTEUR {location.index}</small><strong>{location.name}</strong><span>{location.subtitle}</span>{!compact && <p>{location.detail}</p>}
      </button>)}
    </div>}
    <p className="mission-rule">{value.mode === "campaign" ? "Une nouvelle référence à chaque lieu. Une erreur efface les validations du lieu en cours ; les secteurs terminés restent acquis." : "Chaque erreur remet les neuf validations de ce lieu à zéro."}</p>
  </fieldset>;
}
