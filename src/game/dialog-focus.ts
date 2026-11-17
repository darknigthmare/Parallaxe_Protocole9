import {menuElements} from './gamepad-menu';

/** Same topmost surface for keyboard and controller; a graphics failure wins over editing. */
export function topDialog(root:ParentNode):HTMLElement|null {
  for(const selector of ['.graphics-error','.pad-keyboard','.modal-panel']){
    const panel=root.querySelector<HTMLElement>(selector);
    if(panel&&panel.getClientRects().length&&!panel.hidden)return panel;
  }
  return null;
}

/** A mounted modal owns input only within the game root. Cleanup restores exact inert attributes. */
export function containDialog(panel:HTMLElement,boundary:HTMLElement,onEscape:()=>void,returnFocus?:HTMLElement|null):()=>void {
  if(!boundary.contains(panel))throw new Error('Dialog outside game root');
  const doc=panel.ownerDocument;
  const previous=returnFocus??doc.activeElement as HTMLElement|null;
  const previousTab=panel.getAttribute('tabindex');
  const inerted=new Map<HTMLElement,string|null>();
  let alive=true,redirecting=false;
  // Walk the panel's ancestor chain, not document.body: scripts and browser chrome are untouched.
  let branch:HTMLElement=panel;
  while(branch!==boundary&&branch.parentElement){
    for(const sibling of Array.from(branch.parentElement.children)){
      if(sibling===branch||!(sibling instanceof HTMLElement))continue;
      inerted.set(sibling,sibling.getAttribute('inert'));sibling.setAttribute('inert','');
    }
    branch=branch.parentElement;
  }
  panel.setAttribute('tabindex','-1');
  const first=()=>menuElements(panel)[0]??panel;
  const focus=(node:HTMLElement)=>{redirecting=true;try{node.focus({preventScroll:true});}finally{redirecting=false;}};
  const repair=()=>{
    if(!alive||!panel.isConnected)return;
    const active=doc.activeElement as HTMLElement|null;
    if(active!==panel&&(!active||!panel.contains(active)||!menuElements(panel).includes(active)))focus(first());
  };
  const key=(event:KeyboardEvent)=>{
    if(!alive||event.defaultPrevented||event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();
      if(!event.repeat)onEscape();
    }else if(event.key==='Tab'){
      event.preventDefault();event.stopPropagation();
      const list=menuElements(panel),index=list.indexOf(doc.activeElement as HTMLElement);
      const next=list.length?(index<0?(event.shiftKey?list[list.length-1]:list[0]):list[(index+(event.shiftKey?-1:1)+list.length)%list.length]):panel;
      focus(next);next.scrollIntoView?.({block:'nearest',inline:'nearest'});
    }
  };
  const focusin=()=>{if(!redirecting)repair();};
  doc.addEventListener('keydown',key);doc.addEventListener('focusin',focusin);
  // A disabled/removed focused control (e.g. after a file import) must not strand focus on body.
  const observer=new MutationObserver(repair);
  observer.observe(panel,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','inert','tabindex','open','style','class']});
  if(!panel.contains(doc.activeElement))focus(first());
  return ()=>{
    if(!alive)return;alive=false;observer.disconnect();
    doc.removeEventListener('keydown',key);doc.removeEventListener('focusin',focusin);
    if(previousTab===null)panel.removeAttribute('tabindex');else panel.setAttribute('tabindex',previousTab);
    for(const [node,value] of inerted){if(value===null)node.removeAttribute('inert');else node.setAttribute('inert',value);}
    // Never focus a detached opener or a control still hidden behind another modal.
    if(previous?.isConnected&&previous.getClientRects().length&&!previous.closest('[inert],[hidden],[aria-hidden="true"]'))previous.focus({preventScroll:true});
  };
}
