"use client";
import {useEffect,useState} from 'react';
import type {PerformanceCapture} from '@/src/game/performance-capture';
import {downloadJson} from './training-storage';
export function PerformanceSettings({capture,allowed}:{capture:PerformanceCapture;allowed:boolean}){
 const [report,setReport]=useState(()=>capture.result());const [duration,setDuration]=useState(60);
 useEffect(()=>{const id=setInterval(()=>setReport(capture.result()),500);return()=>clearInterval(id);},[capture]);
 return <section className="utility-settings"><h3>Mesure technique locale</h3><p>Disponible pendant la référence solo uniquement. Fermez les paramètres pour mesurer ; les menus et les pertes de focus sont exclus. Aucune donnée n’est envoyée. Le temps CPU n’est pas un temps GPU.</p>
 <label>Durée active <select value={duration} aria-label="Durée de la mesure technique" onChange={e=>setDuration(+e.target.value)}><option value={30}>30 secondes</option><option value={60}>60 secondes</option><option value={1800}>30 minutes</option></select></label>
 <div className="utility-actions"><button type="button" className="outline-button" disabled={!allowed||capture.recording} onClick={()=>{capture.start(duration);setReport(capture.result());}}>Préparer la mesure</button><button type="button" className="outline-button" disabled={!capture.recording} onClick={()=>{capture.stop();setReport(capture.result());}}>Arrêter la mesure</button><button type="button" className="text-button" disabled={!report.frames} onClick={()=>downloadJson('PARALLAXE_mesure_locale.json',capture.result())}>Exporter le rapport</button></div>
 {!allowed&&<p>Lancez une référence en entraînement solo pour démarrer une mesure, sans mélanger les perceptions d’une inspection.</p>}
 <p role="status">{report.status==='recording'?'Mesure préparée / en cours':report.status==='idle'?'Aucune mesure':report.status==='completed'?'Mesure terminée':'Mesure arrêtée'} · {report.frames} images · {report.activeSeconds.toFixed(1)} s actives</p>
 {report.frames>0&&<dl className="performance-values"><div><dt>Intervalle moyen</dt><dd>{report.intervalMs.mean.toFixed(1)} ms</dd></div><div><dt>95 % des intervalles ≤</dt><dd>{report.intervalMs.p95Upper.toFixed(1)} ms</dd></div><div><dt>Scène CPU moyenne, soumission comprise</dt><dd>{report.cpuSubmissionMs.mean.toFixed(1)} ms</dd></div><div><dt>Appels de dessin moyens, reflets inclus</dt><dd>{report.render.meanCalls.toFixed(0)}</dd></div></dl>}
 <p className="fine-print">Aucun objectif FPS n’est certifié par cet outil. Comparez le même lieu, parcours, résolution, qualité et appareil ; les pauses rallongent la durée réelle de la mesure.</p></section>;
}
