/** Server-only TURN REST credentials. Never import this module into the browser UI. */
export type IceSettings={PARALLAXE_STUN_URLS?:string;PARALLAXE_TURN_URLS?:string;PARALLAXE_TURN_SECRET?:string};
export async function makeRadioConfig(settings:IceSettings,playerId:string,now=Date.now()){
  const stun=(settings.PARALLAXE_STUN_URLS??'stun:stun.l.google.com:19302').split(',').map(v=>v.trim()).filter(v=>/^stuns?:[^\s]+$/.test(v)).slice(0,4);
  const turn=(settings.PARALLAXE_TURN_URLS??'').split(',').map(v=>v.trim()).filter(v=>/^turns?:[^\s]+$/.test(v)).slice(0,4);
  const iceServers:{urls:string|string[];username?:string;credential?:string}[]=stun.map(url=>({urls:url}));
  const expiresAt=now+60*60*1000;
  const turnConfigured=turn.length>0&&Boolean(settings.PARALLAXE_TURN_SECRET);
  if(turnConfigured){
    const username=`${Math.floor(expiresAt/1000)}:${playerId}`;
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(settings.PARALLAXE_TURN_SECRET!),{name:'HMAC',hash:'SHA-1'},false,['sign']);
    const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
    const credential=btoa(String.fromCharCode(...signature));
    iceServers.push({urls:turn,username,credential});
  }
  return {iceServers,expiresAt,turnConfigured};
}
