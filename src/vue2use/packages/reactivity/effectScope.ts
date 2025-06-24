import warn from "./warning";
import { Watcher } from "./effect";

let activeEffectScope: EffectScope | null = null;

class EffectScope {
  private detached: boolean;
  private _active: boolean;
  private effects: Watcher[];
  cleanups: any[];
  private parent: EffectScope | null;
  private index: number | void;
  scopes?: any[];

  constructor(detached = false) {
    this.index = void 0;
    this.detached = detached;
    this._active = true;
    this.effects = [];
    this.cleanups = [];
    this.parent = activeEffectScope;
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1;
    }
  }

  get active(): boolean {
    return this._active;
  }

  run(fn: () => void): void {
    if (this._active) {
      this.parent = activeEffectScope;
      this.on();
      try {
        return fn();
      } finally {
        this.off();
      }
    } else if (process.env.NODE_ENV !== "production") {
      warn(`cannot run an inactive effect scope.`);
    }
  }

  on(): void {
    activeEffectScope = this;
  }

  off(): void {
    activeEffectScope = this.parent;
  }

  stop(fromParent?: boolean): void {
    if (this._active) {
      let i, l;
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].teardown();
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]();
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true);
        }
      }
      if (!this.detached && this.parent && !fromParent) {
        //@ts-ignore
        const last = this.parent.scopes.pop();
        if (last && last !== this) {
          //@ts-ignore
          this.parent.scopes[this.index] = last;
          last.index = this.index;
        }
      }
      this.parent = null;
      this._active = false;
    }
  }
}

/**
 * Returns the current active effect scope if there is one.
 */
function getCurrentScope(): EffectScope | null {
  return activeEffectScope;
}

/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 */
function onScopeDispose(fn: () => void): void {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn);
  } else {
    warn(
      "onScopeDispose() is called when there is no active effect scope" +
        " to be associated with."
    );
  }
}

export { activeEffectScope, EffectScope, onScopeDispose, getCurrentScope };
