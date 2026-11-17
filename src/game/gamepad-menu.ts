/** Standard-mapped controller menu input; never synthesizes keyboard/gameplay keys. */
export type MenuAction = 'previous'|'next'|'left'|'right'|'activate'|'back';
export type MenuPad = {index:number;id:string;mapping:string;connected:boolean;axes:readonly number[];buttons:readonly {pressed:boolean}[]};
export function selectMenuPad(pads:readonly (MenuPad|null)[]):MenuPad|null {
  return pads.find(p=>p?.connected&&p.mapping==='standard')??null;
}
export class MenuPadGate {
  private identity=''; private context=''; private armed=false;
  private previous:boolean[]=[]; private direction=''; private repeatAt=0;
  reset(){this.identity='';this.context='';this.armed=false;this.previous=[];this.direction='';this.repeatAt=0;}
  update(pad:MenuPad|null,context:string,enabled:boolean,now:number):MenuAction[] {
    if(!enabled||!pad||!pad.connected||pad.mapping!=='standard'||!Number.isFinite(now)||pad.axes.some(v=>!Number.isFinite(v)||Math.abs(v)>1)){this.reset();return [];}
    const identity=`${pad.index}:${pad.id}`;
    if(identity!==this.identity||context!==this.context){this.reset();this.identity=identity;this.context=context;}
    const down=pad.buttons.map(b=>b?.pressed===true);
    const x=Number.isFinite(pad.axes[0])?pad.axes[0]:0,y=Number.isFinite(pad.axes[1])?pad.axes[1]:0;
    // A held confirmation at reconnect/focus/menu change cannot activate a new screen.
    if(!this.armed){this.armed=!down.some(Boolean)&&Math.abs(x)<.35&&Math.abs(y)<.35;this.previous=down;return [];}
    const edge=(n:number)=>down[n]&&!this.previous[n];
    const back=edge(1)||edge(9),activate=edge(0);
    const dir=down[12]?'previous':down[13]?'next':down[14]?'left':down[15]?'right':
      Math.abs(y)>.60&&Math.abs(y)>=Math.abs(x)?(y<0?'previous':'next'):Math.abs(x)>.60?(x<0?'left':'right'):'';
    const actions:MenuAction[]=[];
    if(back)actions.push('back');else if(activate)actions.push('activate');
    else if(dir&&(dir!==this.direction||now>=this.repeatAt)){actions.push(dir as MenuAction);this.repeatAt=now+(dir===this.direction?130:420);}
    if(!dir)this.repeatAt=0;
    this.direction=dir;this.previous=down;
    return actions;
  }
}
export const FOCUSABLE='button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]';
export function menuElements(root:HTMLElement):HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(e=>{
    if(e.tabIndex<0||e.matches(':disabled')||!e.getClientRects().length||e.closest('[hidden],[inert],[aria-hidden="true"]')||e.getAttribute('aria-disabled')==='true')return false;
    const style=e.ownerDocument?.defaultView?.getComputedStyle(e);
    if(style?.visibility==='hidden'||style?.visibility==='collapse')return false;
    // Descendants of a closed disclosure are not focus targets; its first summary remains usable.
    let ancestor=e.parentElement;
    while(ancestor&&ancestor!==root){
      if(ancestor.tagName==='DETAILS'&&!ancestor.hasAttribute('open')){
        const summary=Array.from(ancestor.children).find(child=>child.tagName==='SUMMARY');
        if(!summary?.contains(e))return false;
      }
      ancestor=ancestor.parentElement;
    }
    return true;
  }).sort((a,b)=>((a.tabIndex>0?a.tabIndex:Infinity)-(b.tabIndex>0?b.tabIndex:Infinity))||0);
}
export function stepValue(value:number,minimum:number,maximum:number,step:number,direction:number):number {
  if(![value,minimum,maximum,step,direction].every(Number.isFinite)||maximum<minimum||step<=0)return value;
  return Math.min(maximum,Math.max(minimum,Number((minimum+(Math.round((value-minimum)/step)+direction)*step).toFixed(8))));
}
/** Use the native setter so React's controlled input observes the new value. */
export function setControlValue(node:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,value:string):void {
  const proto=Object.getPrototypeOf(node);
  Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(node,value);
  node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));
}
export function navigateMenu(root:HTMLElement,action:MenuAction,hooks:{back:()=>void;edit:(node:HTMLInputElement|HTMLTextAreaElement)=>void}):void {
  if(action==='back'){hooks.back();return;}
  const elements=menuElements(root);if(!elements.length)return;
  const index=elements.indexOf(document.activeElement as HTMLElement);
  const current=elements[index];
  if(index<0){elements[0].focus();return;}
  if(action==='activate'){
    if(current.matches('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea')){
      if(!(current as HTMLInputElement).readOnly)hooks.edit(current as HTMLInputElement|HTMLTextAreaElement);
    }else if(!current.matches('select,input[type="range"],[data-pad-hold]'))current.click();
    return;
  }
  if((action==='left'||action==='right')&&current.matches('input[type="range"],select')){
    const direction=action==='left'?-1:1;
    if(current.tagName==='SELECT'){
      // tagName is checked above; worker and browser DOM declarations coexist in this project.
      const select=current as unknown as HTMLSelectElement,options=Array.from(select.options).filter(o=>!o.disabled);
      const at=options.findIndex(o=>o.value===select.value),next=options[Math.max(0,Math.min(options.length-1,at+direction))];
      if(next)setControlValue(select,next.value);
    }else{const input=current as HTMLInputElement;setControlValue(input,String(stepValue(+input.value,+(input.min||0),+(input.max||100),+(input.step||1),direction)));}
    return;
  }
  const delta=action==='previous'||action==='left'?-1:1;
  const next=elements[(index+delta+elements.length)%elements.length];next.focus();next.scrollIntoView?.({block:'nearest',behavior:'instant'});
}

/** Gameplay sticks/buttons require a fresh neutral state after every interruption. */
export class GameplayPadGate {
  private identity='';private context='';private armed=false;
  reset(){this.identity='';this.context='';this.armed=false;}
  accept(pad:MenuPad|null,context:string,enabled:boolean):boolean{
    if(!enabled||!pad||!pad.connected||pad.mapping!=='standard'||pad.axes.some(v=>!Number.isFinite(v)||Math.abs(v)>1)){this.reset();return false;}
    const id=`${pad.index}:${pad.id}`;
    if(id!==this.identity||context!==this.context){this.reset();this.identity=id;this.context=context;}
    if(!this.armed){this.armed=!pad.buttons.some(b=>b.pressed)&&pad.axes.every(v=>Number.isFinite(v)&&Math.abs(v)<.20);return false;}
    return true;
  }
}
