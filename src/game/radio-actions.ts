/** Prevent a retired radio action from changing the current UI's pending/error state. */
export class RadioActionGate {
  private generation=0;
  constructor(private readonly onPending:(pending:boolean)=>void){}
  begin(){
    const generation=++this.generation;
    const isCurrent=()=>generation===this.generation;
    this.onPending(true);
    return {isCurrent,finish:()=>{if(isCurrent())this.onPending(false);}};
  }
  async run(action:()=>Promise<void>,onError:(error:unknown)=>void):Promise<void>{
    const operation=this.begin();
    try{await action();}
    catch(error){if(operation.isCurrent())onError(error);}
    finally{operation.finish();}
  }
  cancel():void{this.invalidate();this.onPending(false);}
  /** Cleanup must invalidate callbacks without updating an unmounted component. */
  invalidate():void{this.generation++;}
}
