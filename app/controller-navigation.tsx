"use client";
import {useEffect,useRef,useState} from 'react';
import {MenuPadGate,navigateMenu,selectMenuPad,setControlValue} from '@/src/game/gamepad-menu';

const LETTERS=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
const DIGITS=Array.from('0123456789');
const ACCENTS=Array.from('ÀÂÇÉÈÊËÎÏÔÙÛÜŸŒ');
type Edit={node:HTMLInputElement|HTMLTextAreaElement;value:string;scope:string;label:string;max:number};
/** Runs independently of WebGL, so all menus remain usable after a graphics failure. */
export function ControllerNavigation({enabled,scope,onBack}:{enabled:boolean;scope:string;onBack:()=>void}){
  const gate=useRef(new MenuPadGate());
  const latest=useRef({enabled,scope,onBack});latest.current={enabled,scope,onBack};
  const [edit,setEdit]=useState<Edit|null>(null);const editRef=useRef(edit);editRef.current=edit;
  const [lower,setLower]=useState(false);const [connected,setConnected]=useState(false);
  useEffect(()=>{setEdit(null);gate.current.reset();},[scope,enabled]);
  useEffect(()=>{
    let raf=0,alive=true,wasConnected=false;
    const tick=(now:number)=>{
      if(!alive)return;
      const {enabled,scope,onBack}=latest.current;
      let pad=null;try{pad=selectMenuPad(Array.from(navigator.getGamepads?.()??[]));}catch{/* Browser may deny Gamepad API. */}
      if(!!pad!==wasConnected){wasConnected=!!pad;setConnected(wasConnected);}
      const active=editRef.current;
      const focused=!document.hidden&&document.hasFocus();
      const root=document.querySelector<HTMLElement>('.pad-keyboard')??document.querySelector<HTMLElement>('.graphics-error')??document.querySelector<HTMLElement>('.modal-panel')??document.querySelector<HTMLElement>('.result-panel')??document.querySelector<HTMLElement>('.lobby-screen')??document.querySelector<HTMLElement>('.game-root');
      const key=scope+(active?':keyboard':'');
      for(const action of gate.current.update(pad,key,enabled&&focused,now))if(root)navigateMenu(root,action,{
        back:()=>{if(editRef.current){const node=editRef.current.node;setEdit(null);node.focus();}else onBack();},
        edit:node=>{setLower(false);setEdit({node,scope,value:node.value,label:node.getAttribute('aria-label')||node.placeholder||'Saisie',max:node.maxLength>0?Math.min(node.maxLength,2000):280});},
      });
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const interrupt=()=>{gate.current.reset();};
    const escape=(e:KeyboardEvent)=>{if(editRef.current&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();const node=editRef.current.node;setEdit(null);node.focus();gate.current.reset();}};
    window.addEventListener('blur',interrupt);window.addEventListener('gamepaddisconnected',interrupt);document.addEventListener('visibilitychange',interrupt);document.addEventListener('keydown',escape,true);
    return()=>{alive=false;cancelAnimationFrame(raf);window.removeEventListener('blur',interrupt);window.removeEventListener('gamepaddisconnected',interrupt);document.removeEventListener('visibilitychange',interrupt);document.removeEventListener('keydown',escape,true);};
  },[]);
  useEffect(()=>{if(edit)document.querySelector<HTMLButtonElement>('.pad-keyboard button')?.focus();},[edit?.node]);
  if(!enabled)return null;
  const finish=()=>{if(edit&&edit.scope===scope&&edit.node.isConnected){setControlValue(edit.node,edit.value);edit.node.focus();}setEdit(null);};
  return <>{connected&&<div className="pad-hint">Croix / stick : parcourir · A / × : choisir · B / ○ : retour · ← → : régler</div>}
    {edit&&edit.scope===scope&&<div className="pad-keyboard-backdrop"><section className="pad-keyboard" role="dialog" aria-modal="true" aria-label={`Clavier — ${edit.label}`} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();navigateMenu(e.currentTarget,e.shiftKey?'previous':'next',{back:()=>setEdit(null),edit:()=>{}});e.stopPropagation();}}}>
      <h2>{edit.label}</h2><output className="pad-draft" aria-live="polite">{edit.value||'Votre texte…'}</output><small>{edit.value.length}/{edit.max} caractères · rien n’est envoyé avant confirmation.</small>
      <div className="pad-keys">{[...LETTERS,...DIGITS,...ACCENTS,' ','.',',','?','!','-','_','’',':','/'].map(char=><button type="button" key={char} onClick={()=>setEdit(old=>old?{...old,value:(old.value+(lower?char.toLowerCase():char)).slice(0,old.max)}:null)}>{char===' '?'Espace':lower?char.toLowerCase():char}</button>)}</div>
      <div className="pad-key-actions"><button type="button" onClick={()=>setLower(v=>!v)}>{lower?'Majuscules':'Minuscules'}</button><button type="button" onClick={()=>setEdit(v=>v?{...v,value:Array.from(v.value).slice(0,-1).join('')}:null)}>Effacer le dernier</button><button type="button" onClick={finish}>Valider le texte</button><button type="button" onClick={()=>{edit.node.focus();setEdit(null);}}>Annuler</button></div>
    </section></div>}
  </>;
}
