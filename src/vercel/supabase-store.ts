import type {SessionStore,StoredRoom} from './session-handler';

type Settings={url:string;publishableKey:string;storeToken:string;request?:typeof fetch};

// Only the server knows storeToken. The public API key alone cannot read or
// mutate sessions: each RPC authenticates it before accessing its private schema.
// Atomic revision checks run in Postgres, independently of Function instances.
export function createSupabaseSessionStore({url,publishableKey,storeToken,request=fetch}:Settings):SessionStore{
  const target=new URL(url);
  if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash
    ||target.pathname!=='/'||!publishableKey||!/^[a-f0-9]{64}$/i.test(storeToken)){
    throw new Error('Configuration du stockage de session invalide.');
  }
  async function rpc(name:string,parameters:Record<string,unknown>):Promise<unknown>{
    let response:Response;
    try{
      response=await request(new URL(`/rest/v1/rpc/parallaxe_web_${name}`,target),{
        method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},
        body:JSON.stringify({p_store_token:storeToken,...parameters}),
        signal:AbortSignal.timeout(8000),cache:'no-store',
      });
    }catch{throw new Error('Le stockage de session ne répond pas.');}
    // Do not log provider responses: they may contain request or database details.
    if(!response.ok)throw new Error('Le stockage de session est temporairement indisponible.');
    return response.json();
  }
  function code(value:string){
    if(!/^[A-Z2-9]{6}$/.test(value))throw new Error('Code de session invalide.');
    return value;
  }
  function values(row:StoredRoom){
    return {p_code:code(row.code),p_version:row.version,p_data:row.data,p_updated_at:row.updated_at,p_expires_at:row.expires_at};
  }
  async function write(name:string,parameters:Record<string,unknown>){
    const result=await rpc(name,parameters);
    if(typeof result!=='boolean')throw new Error('Réponse du stockage de session invalide.');
    return result;
  }
  return {
    async read(requestedCode){
      const raw=await rpc('read',{p_code:code(requestedCode)});
      if(raw===null)return null;
      if(typeof raw!=='object')throw new Error('État de session illisible.');
      const row=raw as StoredRoom;
      if(row.code!==requestedCode||!Number.isSafeInteger(row.version)||row.version<0||typeof row.data!=='string'
        ||!Number.isSafeInteger(row.updated_at)||!Number.isSafeInteger(row.expires_at)){
        throw new Error('État de session invalide.');
      }
      return row;
    },
    insert:row=>write('insert',values(row)),
    compareAndSwap:(row,expectedVersion)=>write('cas',{...values(row),p_expected_version:expectedVersion}),
    // The insert RPC performs bounded expiry cleanup using the database clock.
    // Reads and CAS also reject expired rows without depending on cleanup timing.
  };
}
