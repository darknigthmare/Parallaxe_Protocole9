/** A held controller button must be released after focus loss or an input pause. */
export class HoldToTalkGate {
  private armed=false;
  private held=false;

  suspend():void {
    this.armed=false;
    this.held=false;
  }

  /** Return an edge only. Repeated frames must not restart a timed-out transmission. */
  update(down:boolean,allowed:boolean):boolean|null {
    if(!allowed){
      const stop=this.held;
      this.suspend();
      return stop?false:null;
    }
    if(!down){
      const stop=this.held;
      this.held=false;
      this.armed=true;
      return stop?false:null;
    }
    if(!this.armed||this.held)return null;
    this.held=true;
    return true;
  }
}
