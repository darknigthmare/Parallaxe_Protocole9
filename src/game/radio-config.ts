/** Server-only TURN REST credentials. Never import this module into the browser UI. */
export type IceSettings={PARALLAXE_STUN_URLS?:string;PARALLAXE_TURN_URLS?:string;PARALLAXE_TURN_SECRET?:string};
export const RADIO_CREDENTIAL_TTL=60*60*1000;
const DEFAULT_STUN='stun:stun.l.google.com:19302';
const MAX_URLS=4;
type IceKind='stun'|'turn';
export type RadioConfigIssue='invalid-stun-url'|'invalid-turn-url'|'duplicate-url'|'url-limit'
  |'missing-turn-secret'|'unused-turn-secret'|'weak-turn-secret'|'no-ice-servers';
export type RadioConfigDiagnostics={issues:RadioConfigIssue[];invalidUrls:number;duplicateUrls:number;omittedUrls:number};

function validIPv4(host:string):boolean {
  const octets=host.split('.');
  return octets.length===4&&octets.every(part=>/^(0|[1-9][0-9]{0,2})$/.test(part)&&Number(part)<=255);
}
function validIPv6(host:string):boolean {
  const halves=host.split('::');
  if(halves.length>2)return false;
  const parts=halves.flatMap(half=>half===''?[]:half.split(':'));
  let size=0;
  for(let index=0;index<parts.length;index++){
    const part=parts[index];
    if(part.includes('.')){
      if(index!==parts.length-1||!host.endsWith(part)||!validIPv4(part))return false;
      size+=2;
    }else{
      if(!/^[0-9a-f]{1,4}$/i.test(part))return false;
      size++;
    }
  }
  return halves.length===2?size<8:size===8;
}
function validHost(host:string):boolean {
  if(host.startsWith('['))return host.endsWith(']')&&validIPv6(host.slice(1,-1));
  if(/^[0-9.]+$/.test(host))return validIPv4(host);
  const dns=host.endsWith('.')?host.slice(0,-1):host;
  return dns.length>0&&dns.length<=253&&dns.split('.').every(label=>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}
/** A conservative WebRTC URI profile, not a general-purpose URL parser.
 * RFC 7064/7065: opaque scheme:host[:port], with TURN-only ?transport=udp|tcp.
 * DNS/punycode, IPv4 and bracketed IPv6 are supported; credentials never belong in a URI.
 */
export function normalizeIceUrl(value:string,kind:IceKind):string|null {
  if(typeof value!=='string'||value.length>2048)return null;
  const match=/^(stuns?|turns?):(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?(?:\?transport=(udp|tcp))?$/i.exec(value.trim());
  if(!match)return null;
  const [,rawScheme,rawHost,rawPort,rawTransport]=match;
  const scheme=rawScheme.toLowerCase(),host=rawHost.toLowerCase(),transport=rawTransport?.toLowerCase();
  if(!scheme.startsWith(kind)||!validHost(host))return null;
  if(rawPort!==undefined&&(Number(rawPort)<1||Number(rawPort)>65535))return null;
  if(kind==='stun'&&transport)return null;
  // The game supports browser TLS-over-TCP, not TURN DTLS-over-UDP.
  if(scheme==='turns'&&transport==='udp')return null;
  return `${scheme}:${host}${rawPort===undefined?'':`:${Number(rawPort)}`}${transport?`?transport=${transport}`:''}`;
}

/** Redacted diagnostics: neither rejected input nor the shared secret is returned. */
export function analyzeRadioSettings(settings:IceSettings){
  const diagnostics:RadioConfigDiagnostics={issues:[],invalidUrls:0,duplicateUrls:0,omittedUrls:0};
  const issue=(code:RadioConfigIssue)=>{if(!diagnostics.issues.includes(code))diagnostics.issues.push(code);};
  const parse=(raw:unknown,kind:IceKind):string[]=>{
    if(typeof raw!=='string'){diagnostics.invalidUrls++;issue(`invalid-${kind}-url`);return [];}
    const result:string[]=[],seen=new Set<string>();
    for(const entry of raw.split(',')){
      if(!entry.trim())continue;
      const normalized=normalizeIceUrl(entry,kind);
      if(!normalized){diagnostics.invalidUrls++;issue(`invalid-${kind}-url`);continue;}
      if(seen.has(normalized)){diagnostics.duplicateUrls++;issue('duplicate-url');continue;}
      seen.add(normalized);
      if(result.length>=MAX_URLS){diagnostics.omittedUrls++;issue('url-limit');continue;}
      result.push(normalized);
    }
    return result;
  };
  const stun=parse(settings.PARALLAXE_STUN_URLS??DEFAULT_STUN,'stun');
  const turn=parse(settings.PARALLAXE_TURN_URLS??'','turn');
  const secret=settings.PARALLAXE_TURN_SECRET;
  const hasSecret=typeof secret==='string'&&secret.trim().length>0;
  const turnConfigured=turn.length>0&&hasSecret;
  if(turn.length&&!hasSecret)issue('missing-turn-secret');
  if(!turn.length&&hasSecret)issue('unused-turn-secret');
  if(turnConfigured&&new TextEncoder().encode(secret!).length<32)issue('weak-turn-secret');
  if(!stun.length&&!turnConfigured)issue('no-ice-servers');
  return {stun,turn,turnConfigured,diagnostics};
}

export async function makeRadioConfig(settings:IceSettings,playerId:string,now=Date.now()){
  if(typeof playerId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(playerId))throw new TypeError('Identité radio invalide.');
  if(!Number.isSafeInteger(now)||now<0||now>Number.MAX_SAFE_INTEGER-RADIO_CREDENTIAL_TTL)throw new TypeError('Horloge radio invalide.');
  const {stun,turn,turnConfigured,diagnostics}=analyzeRadioSettings(settings);
  const iceServers:{urls:string|string[];username?:string;credential?:string}[]=stun.map(url=>({urls:url}));
  // Report exactly the expiry encoded into the TURN username, not up to 999 ms later.
  const expiresAt=Math.floor((now+RADIO_CREDENTIAL_TTL)/1000)*1000;
  if(turnConfigured){
    const username=`${expiresAt/1000}:${playerId}`;
    // Preserve a non-blank secret byte for byte; trimming would change the HMAC key.
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(settings.PARALLAXE_TURN_SECRET!),{name:'HMAC',hash:'SHA-1'},false,['sign']);
    const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
    const credential=btoa(String.fromCharCode(...signature));
    iceServers.push({urls:turn,username,credential});
  }
  return {iceServers,expiresAt,turnConfigured,diagnostics};
}
