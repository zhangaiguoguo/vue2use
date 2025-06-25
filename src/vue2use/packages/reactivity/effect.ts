import vm from "../vm";
import { activeEffectScope } from "./effectScope";
import { DebuggerEvent, DebuggerOptions } from "./debug";
import { Dep, DepTarget } from "./dep";
import type { ComponentInstance } from "vue/types/index";

const V2Watcher: Watcher =
  //@ts-ignore
  vm._watcher?.constructor ||
  //@ts-ignore
  vm._computedWatchers?.watcher?.constructor ||
  //@ts-ignore
  vm._watchers?.[0]?.constructor;

//@ts-ignore
const v2WatcherPrototype = V2Watcher.prototype;

class Watcher implements DepTarget {
  vm?: ComponentInstance | null | void;
  //@ts-ignore
  cb: Function | null;
  //@ts-ignore
  id: number;
  //@ts-ignore
  user: boolean;
  //@ts-ignore
  dirty: boolean | null;
  //@ts-ignore
  expression: string;
  //@ts-ignore
  active: boolean | null;
  //@ts-ignore
  deps: Array<Dep2> | null;
  //@ts-ignore
  getter: Function | null;
  value: any;
  //@ts-ignore
  noRecurse: boolean;
  post?: boolean | void;

  onTrack?: ((event: DebuggerEvent) => void) | undefined;
  onTrigger?: ((event: DebuggerEvent) => void) | undefined;
  before?: Function;
  onStop?: Function;

  constructor(
    vm: ComponentInstance | null | void,
    expOrFn: string | (() => any),
    cb: Function,
    options?: WatcherOptions | null,
    isRenderWatcher?: boolean
  ) {
    //@ts-ignore
    return new V2Watcher(vm, expOrFn, cb, options, isRenderWatcher);
  }

  get(): any {}

  addDep(dep: Dep): void {}

  cleanupDeps(): void {}

  update(): void {}

  run(): void {}

  evaluate(): void {}

  depend(): void {}

  teardown(): void {}
}

let activeEffect: Watcher | null = null;
let shouldTrack = true;
let pauseScheduleStack = 0;
let trackStack: boolean[] = [];
let queueEffectSchedulers: Function[] = [];

function pauseTracking(): void {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}

function resetTracking(): void {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}

function pauseScheduling(): void {
  pauseScheduleStack++;
}

function resetScheduling(): void {
  pauseScheduleStack--;
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    //@ts-ignore
    queueEffectSchedulers.shift()();
  }
}

//@ts-ignore
V2Watcher.prototype = new Proxy(v2WatcherPrototype, {
  get(target, p, receiver) {
    switch (p) {
      case "get":
        return () => {
          receiver.parent = activeEffect;
          activeEffect = receiver;
          try {
            const res = v2WatcherPrototype[p].call(receiver);
            if (activeEffectScope) {
              //@ts-ignore
              activeEffectScope.effects.push(receiver);
            }
            return res;
          } finally {
            activeEffect = receiver.parent ?? null;
          }
        };
    }
    return Reflect.get(target, p, receiver);
  },
});

interface WatcherOptions extends DebuggerOptions {
  deep?: boolean;
  user?: boolean;
  lazy?: boolean;
  sync?: boolean;
  before?: Function;
}

export {
  activeEffect,
  resetScheduling,
  pauseTracking,
  resetTracking,
  pauseScheduling,
  queueEffectSchedulers,
  Watcher,
  type WatcherOptions,
};
