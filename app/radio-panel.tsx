"use client";

import { AudioLines, Mic, MicOff, Radio, ShieldCheck, Signal, Square, Volume2 } from "lucide-react";
import type { RadioStatus } from "@/src/game/radio";

export function TalkButton({ enabled, talking, onTalk, compact = false }: {
  enabled: boolean; talking: boolean; onTalk: (talking: boolean) => void; compact?: boolean;
}) {
  return <button type="button" className={`talk-button ${talking ? "transmitting" : ""} ${compact ? "compact" : ""}`} disabled={!enabled}
    aria-label="Maintenir pour parler au talkie" aria-pressed={talking}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onTalk(true); }}
    onPointerUp={() => onTalk(false)} onPointerCancel={() => onTalk(false)} onLostPointerCapture={() => onTalk(false)}
    onKeyDown={event => { if (["Space", "Enter"].includes(event.code)) { event.preventDefault(); if (!event.repeat) onTalk(true); } }}
    onKeyUp={event => { if (["Space", "Enter"].includes(event.code)) { event.preventDefault(); onTalk(false); } }} onBlur={() => onTalk(false)}>
    {talking ? <AudioLines size={18}/> : <Radio size={18}/>}<span>{talking ? "TRANSMISSION" : "MAINTENIR POUR PARLER"}</span><kbd>T</kbd>
  </button>;
}

export function RadioPanel({ status, isOnline, pending, probePending, caption, reference, peerNames, onEnable, onListen, onDisable, onReconnect, onStop, onTalk, onProbe, onStopProbe }: {
  status: RadioStatus | null; isOnline: boolean; pending: boolean; caption: string;
  probePending: boolean; reference: string; onStopProbe: () => void;
  peerNames?: Record<string,string>;
  onEnable: () => void; onListen: () => void; onDisable: () => void; onReconnect: () => void; onStop: () => void; onTalk: (talking: boolean) => void; onProbe: () => void;
}) {
  const enabled = status?.microphone ?? false;
  const linked = status?.peers.filter(peer => peer.state === "connected").length ?? 0;
  const connectionLabels:Record<string,string>={new:"Préparation",connecting:"Connexion en cours",connected:"Liaison établie",disconnected:"Liaison interrompue",failed:"Connexion impossible",closed:"Liaison fermée"};
  return <div className="radio-console">
    <div className="radio-face"><div><span className="eyebrow">ÉMETTEUR PORTATIF · P9</span><h3><Radio size={20}/> CANAL D’ÉQUIPE</h3></div><span className={`radio-led ${enabled ? "on" : ""}`} aria-label={enabled ? "Microphone autorisé" : "Microphone coupé"}/></div>
    <div className="radio-display"><div><Signal size={15}/><span>{isOnline ? `${linked} LIAISON${linked > 1 ? "S" : ""} VOCALE${linked > 1 ? "S" : ""}` : "CALIBRATION LOCALE"}</span></div><strong>{status?.probeActive ? "CONTRÔLE EN COURS" : status?.talking ? "VOUS TRANSMETTEZ" : enabled ? "EN ÉCOUTE" : "MICROPHONE COUPÉ"}</strong><div className="mic-meter" role="meter" aria-label="Niveau du microphone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, status?.micLevel ?? 0) * 100)}><i style={{ width: `${Math.min(1, status?.micLevel ?? 0) * 100}%` }}/></div></div>
    {status?.enabled&&isOnline&&<div className="radio-connections">{status.peers.length?status.peers.map((peer,index)=><p key={peer.id}><span>{peerNames?.[peer.id]??`Inspecteur ${index+1}`}</span><b className={peer.state==="connected"?"linked":""}>{connectionLabels[peer.state]??"État inconnu"}</b></p>):<p>En attente d’un autre inspecteur ayant activé son talkie.</p>}</div>}
    <div className="radio-buttons">{isOnline && (enabled ? <button className="outline-button" type="button" onClick={onDisable}><MicOff size={16}/> Couper le microphone</button> : <button className="solid-button" type="button" disabled={pending || status?.supported === false || status?.secure === false} onClick={onEnable}><Mic size={16}/>{pending ? "Activation en cours…" : "Activer mon microphone"}</button>)}{isOnline && !status?.enabled && <button className="outline-button" type="button" disabled={pending} onClick={onListen}>Écouter sans microphone</button>}<button className="outline-button" type="button" disabled={pending || probePending} onClick={onProbe}><Volume2 size={16}/>{probePending ? "Préparation…" : status?.probeActive ? "Relancer le test" : "Test de calibration"}</button><button className="outline-button" type="button" onClick={onStopProbe}><Square size={15}/> Arrêter le test</button></div>
    <p className="calibration-reference"><strong>RÉFÉRENCE DU CONTRÔLE</strong>{reference}</p>
    {isOnline && <TalkButton enabled={enabled} talking={status?.talking ?? false} onTalk={onTalk}/>}
    {caption && <div className="calibration-caption" role="status"><AudioLines size={17}/><div><strong>RELEVÉ DE CALIBRATION</strong><p>{caption}</p></div></div>}
    <p className="radio-instructions">{isOnline ? "Activez le microphone une fois, puis maintenez T ou le bouton pour parler. Votre voix est filtrée comme celle d’un talkie ; relâchez pour écouter." : "Le test fonctionne sans microphone. Comparez le relevé et le son dans vos deux perceptions, comme vous le feriez avec un partenaire."}</p>
    {status?.secure === false && isOnline && <p className="error-line">Le navigateur exige HTTPS pour le microphone sur le réseau local. Le chat écrit reste disponible.</p>}
    {status?.supported === false && isOnline && <p className="error-line">Ce navigateur ne fournit pas la liaison vocale nécessaire. Utilisez le chat écrit ou un navigateur compatible.</p>}
    {status?.error && <p className="error-line" role="status">{status.error}</p>}
    {status?.enabled&&isOnline&&<div className="radio-maintenance"><button type="button" className="text-button" disabled={pending} onClick={onReconnect}>Reconnecter la radio</button><button type="button" className="text-button" onClick={onStop}>Éteindre le talkie</button></div>}
    {!!status?.peers.length&&<details className="radio-diagnostics"><summary>Diagnostic de liaison</summary>{status.peers.map((peer,index)=><div key={peer.id}><strong>{peerNames?.[peer.id]??`Inspecteur ${index+1}`}</strong><p>Négociation : {peer.signalingState} · réseau : {peer.iceConnectionState} · recherche : {peer.iceGatheringState}</p><p>Description locale : {peer.localDescription?"reçue":"en attente"} · distante : {peer.remoteDescription?"reçue":"en attente"}</p><p>Chemins réseau disponibles : {peer.localCandidateCount} local / {peer.remoteCandidateCount} distant</p></div>)}</details>}
    <p className="radio-privacy"><ShieldCheck size={13}/> La voix transite en direct. Le serveur du jeu n’enregistre pas vos conversations.</p>
  </div>;
}
