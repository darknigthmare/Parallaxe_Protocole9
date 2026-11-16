"use client";
import {useState} from 'react';
import {ACTION_LABELS,BINDING_ACTIONS,DEFAULT_BINDINGS,assignBinding,bindingLabel,type BindingAction,type Preferences} from '@/src/game/accessibility';

export function AccessibilitySettings({preferences,onChange}:{preferences:Preferences;onChange:(patch:Partial<Preferences>)=>void}){
  const [capturing,setCapturing]=useState<BindingAction|null>(null);
  const [message,setMessage]=useState('');
  return <div className="accessibility-settings" onKeyDownCapture={event=>{
    if(!capturing)return;
    event.stopPropagation();event.preventDefault();
    if(event.code==='Escape'){setCapturing(null);setMessage('Modification annulée.');return;}
    if(event.repeat||event.nativeEvent.isComposing)return;
    if(event.ctrlKey||event.altKey||event.metaKey){setMessage('Choisissez une touche seule, sans Ctrl, Alt ou Commande.');return;}
    const result=assignBinding(preferences.bindings,capturing,event.code);
    if(result.error){setMessage(result.error);return;}
    onChange({bindings:result.bindings});setMessage(`${ACTION_LABELS[capturing]} : ${bindingLabel(event.code,preferences.keyboardLayout)}.`);setCapturing(null);
  }}>
    <div className="setting-row"><div><h3>Champ de vision vertical</h3><p>50° à 95°. Valeur d’origine : 65°. Ne change ni la vitesse, ni les positions, ni les collisions.</p></div><label><input type="range" min="50" max="95" step="1" value={preferences.fov} aria-label="Champ de vision vertical" onChange={e=>onChange({fov:+e.target.value})}/><span>{Math.round(preferences.fov)}°</span></label></div>
    <label className="toggle-row"><div><h3>Inverser le regard vertical</h3><p>Appliqué à la souris, au regard tactile et au stick droit. Le déplacement reste inchangé.</p></div><input type="checkbox" checked={preferences.invertY} onChange={e=>onChange({invertY:e.target.checked})}/></label>
    <div className="setting-row"><div><h3>Taille des relevés écrits</h3><p>Agrandit les légendes acoustiques, la calibration et les documents d’observation, sans supprimer de preuve.</p></div><label><input type="range" min="1" max="1.5" step="0.1" value={preferences.captionScale} aria-label="Taille des relevés écrits" onChange={e=>onChange({captionScale:+e.target.value})}/><span>{Math.round(preferences.captionScale*100)}%</span></label></div>
    <fieldset className="binding-settings"><legend>Commandes clavier</legend>
      <p>Les touches sont enregistrées par position physique. Choisissez l’affichage de votre clavier ; les flèches et Échap restent toujours disponibles. Aucun changement des boutons tactiles ou de manette.</p>
      <label className="binding-layout">Disposition affichée <select aria-label="Disposition du clavier" value={preferences.keyboardLayout} onChange={e=>{setCapturing(null);onChange({keyboardLayout:e.target.value as Preferences['keyboardLayout']});}}><option value="azerty">AZERTY</option><option value="qwerty">QWERTY</option></select></label>
      <div className="binding-grid">{BINDING_ACTIONS.map(action=><div className="binding-row" key={action}><span>{ACTION_LABELS[action]}</span><button type="button" className={capturing===action?'capturing':''} aria-pressed={capturing===action} aria-label={`Changer la touche : ${ACTION_LABELS[action]}`} onClick={()=>{setCapturing(action);setMessage('Appuyez sur une touche. Échap annule.');}}>{capturing===action?'Appuyez…':bindingLabel(preferences.bindings[action],preferences.keyboardLayout)}</button></div>)}</div>
      <p className="binding-status" role="status" aria-live="polite">{message||'Une touche ne peut pas commander deux actions.'}</p>
      {capturing&&<button type="button" className="text-button" onClick={()=>{setCapturing(null);setMessage('Modification annulée.');}}>Annuler l’affectation</button>}
      <button type="button" className="outline-button wide" onClick={()=>{setCapturing(null);onChange({bindings:{...DEFAULT_BINDINGS}});setMessage('Commandes d’origine restaurées.');}}>Réinitialiser les touches uniquement</button>
    </fieldset>
  </div>;
}
