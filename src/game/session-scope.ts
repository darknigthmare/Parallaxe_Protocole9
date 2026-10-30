/** A local lifetime fence, not a credential store or a server authorization check. */
export type SessionIdentity = Readonly<{code:string;selfId:string}>;

export class SessionScope {
  private generation=0;
  private identity:SessionIdentity|null=null;
  private revision=-1;
  private serverTime=-1;

  /** Replacing even the same room invalidates all work from the previous visit. */
  replace(identity:SessionIdentity|null):void {
    this.generation++;
    this.identity=identity?{code:identity.code,selfId:identity.selfId}:null;
    this.revision=-1;
    this.serverTime=-1;
  }
  invalidate():void {this.replace(null);}
  ticket():number {return this.generation;}
  isCurrent(ticket:number):boolean {return ticket===this.generation;}

  /** Never let a different room, identity or malformed counter poison ordering. */
  accept(value:unknown):boolean {
    if(!this.identity||!value||typeof value!=='object')return false;
    const state=value as Record<string,unknown>;
    if(state.code!==this.identity.code||state.selfId!==this.identity.selfId||!Array.isArray(state.players))return false;
    const revision=state.revision,serverTime=state.serverTime;
    if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0
      ||typeof serverTime!=='number'||!Number.isSafeInteger(serverTime)||serverTime<0)return false;
    if(revision<this.revision||revision===this.revision&&serverTime<this.serverTime)return false;
    this.revision=revision;
    this.serverTime=serverTime;
    return true;
  }
}
