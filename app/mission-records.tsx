"use client";
import {useEffect,useState} from 'react';
import {FIELD_NOTES_KEY,keepMissionNote,missionNote,readFieldNotes,storedMissionNotes,type MissionDebrief} from '@/src/game/mission-records';
import type {LevelId} from '@/src/game/levels';

export function useMissionRecords(){
  const [ids,setIds]=useState<string[]>([]),[message,setMessage]=useState<{levelId:LevelId;text:string}|null>(null);
  useEffect(()=>{
    try{setIds(readFieldNotes(localStorage.getItem(FIELD_NOTES_KEY)));}catch{}
    const changed=(event:StorageEvent)=>{if(event.key===FIELD_NOTES_KEY||event.key===null){try{setIds(readFieldNotes(localStorage.getItem(FIELD_NOTES_KEY)));}catch{setIds([]);}}};
    window.addEventListener('storage',changed);return ()=>window.removeEventListener('storage',changed);
  },[]);
  const keep=(levelId:LevelId,phase:string)=>{
    try{setIds(keepMissionNote(localStorage,levelId,phase));setMessage({levelId,text:'Consigne conservée sur cet appareil. Elle reste accessible dans les Archives.'});}
    catch(error){setMessage({levelId,text:error instanceof Error?error.message:'Note non conservée.'});}
  };
  return {ids,message,keep};
}
export function MissionRecord({levelId,phase,ids,message,onKeep}:{levelId:LevelId;phase:string;ids:string[];message:{levelId:LevelId;text:string}|null;onKeep:(levelId:LevelId,phase:string)=>void}){
  const note=missionNote(levelId);if(!note)return null;
  const saved=ids.includes(note.id);
  return <section className="mission-record" aria-labelledby="mission-record-title" data-note-id={note.id}>
    <span className="eyebrow">CARNET DE MISSION · {note.id}</span>
    <h3 id="mission-record-title">{note.title}</h3><p className="fine-print">{note.source}</p>
    {note.paragraphs.map((line,i)=><p className="mission-record-text" key={i}>{line}</p>)}
    <p className="fine-print">Texte de contexte commun aux témoins. Ce dossier ne donne pas le diagnostic du passage.</p>
    <button type="button" className="outline-button wide" disabled={saved||(phase!=='reference'&&phase!=='inspect')} onClick={()=>onKeep(levelId,phase)}>{saved?'Consigne déjà conservée':'Conserver cette consigne'}</button>
    {message?.levelId===levelId&&<p className="fine-print" role="status">{message.text}</p>}
  </section>;
}
export function MissionRecordArchive({ids}:{ids:string[]}){
  const notes=storedMissionNotes(ids);
  return <section className="mission-record-archive" aria-labelledby="field-notes-title">
    <h3 id="field-notes-title">Consignes conservées · {notes.length}/5</h3>
    <p className="fine-print">Copies du carnet, distinctes des anomalies découvertes. Conservez une consigne pendant un passage pour la relire ici. Elles restent locales à cet appareil ; l’export de progression solo ne les inclut pas.</p>
    {notes.map(note=><article className="mission-record" data-note-id={note.id} key={note.id}><span className="eyebrow">{note.id} · {note.source}</span><h3>{note.title}</h3>{note.paragraphs.map((line,i)=><p className="mission-record-text" key={i}>{line}</p>)}</article>)}
  </section>;
}
export function MissionDebriefPanel({value}:{value:MissionDebrief|null}){
  if(!value)return null;
  return <section className="mission-debrief" aria-labelledby="mission-debrief-title" data-debrief-id={value.id}>
    <h3 id="mission-debrief-title">{value.heading}</h3><p className="fine-print">{value.route}</p>
    {value.paragraphs.map((line,i)=><p key={i}>{line}</p>)}
    <p className="fine-print">{value.attempts} diagnostic{value.attempts>1?'s':''} effectué{value.attempts>1?'s':''} · {value.validated} réponse{value.validated>1?'s':''} correcte{value.validated>1?'s':''} au total · {value.errors} erreur{value.errors>1?'s':''}.</p>
  </section>;
}
