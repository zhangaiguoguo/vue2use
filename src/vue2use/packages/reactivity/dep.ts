import vm from "../vm";
import {
  isArray,
  isIntegerKey,
  isMap,
  isSymbol,
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
} from "./shared";
import {
  activeEffect,
  pauseScheduling,
  queueEffectSchedulers,
  resetScheduling,
} from "./effect";
import { DebuggerEventExtraInfo, DebuggerOptions } from "./debug";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./operations";

export interface DepTarget extends DebuggerOptions {
  id: number;

  addDep(dep: Dep): void;

  update(): void;
}

const { $data } = vm,
  //@ts-ignore
  VDep: Record<string, any> =
    $data[ReactiveFlags.OB][ReactiveFlags.DEP].constructor;

//@ts-ignore
class Dep {
  static target?: DepTarget | null;
  //@ts-ignore
  id: number;
  //@ts-ignore
  subs: Array<DepTarget | null>;
  constructor() {
    //@ts-ignore
    return new VDep();
  }

  depend(info?: DebuggerEventExtraInfo): void {}

  notify(info?: DebuggerEventExtraInfo): void {}
}

type ReactiveProxyDepsType = Map<any, Dep>;

const reactiveProxyDepsMap = new WeakMap<object, ReactiveProxyDepsType>();

function getTargetReactiveProxyDeps(
  target: object
): ReactiveProxyDepsType | void {
  return reactiveProxyDepsMap.get(target);
}

function track(target: object, type: TrackOpTypes, key: any): void {
  if (activeEffect) {
    if (!reactiveProxyDepsMap.has(target)) {
      reactiveProxyDepsMap.set(target, new Map());
    }
    const deps = reactiveProxyDepsMap.get(target) as ReactiveProxyDepsType;
    deps.set(key, deps.get(key) || new Dep());
    switch (type) {
      case "has":
      case "get":
      case "iterate":
        //@ts-ignore
        deps.get(key).depend({
          type,
          key,
          target: target,
        });
        break;
    }
  }
}

function trigger(
  target: object,
  type: TriggerOpTypes,
  key: any,
  newValue?: any,
  oldValue?: any
): void {
  if (reactiveProxyDepsMap.has(target)) {
    const deps = reactiveProxyDepsMap.get(target) as ReactiveProxyDepsType;
    if (!deps) {
      return;
    }
    pauseScheduling();
    const run = (vDep: Dep | void) => {
      vDep &&
        queueEffectSchedulers.push(() => {
          vDep.notify({
            type,
            key,
            target,
            newValue,
            oldValue,
          });
        });
    };
    if (type === "clear") {
      //@ts-ignore
      for (let [_, dep] of deps) {
        run(dep);
      }
    } else if (key === "length" && isArray(target)) {
      const newLength = Number(newValue);
      for (let [key, dep] of deps) {
        if (!isSymbol(key) && key >= newLength) {
          run(dep);
        }
      }
    } else {
      if (key !== void 0 || deps.has(void 0)) {
        run(deps.get(key));
      }
      switch (type) {
        case "set":
          if (isMap(target)) {
            run(deps.get(ITERATE_KEY));
          }
          break;
        case "add":
          if (!isArray(target)) {
            run(deps.get(ITERATE_KEY));
            if (isMap(target)) {
              run(deps.get(MAP_KEY_ITERATE_KEY));
            }
          } else {
            if (isIntegerKey(key)) {
              run(deps.get("length"));
            } else {
              // warn(`${key} is not a valid array key.`);
            }
          }
          break;
        case "delete":
          if (!isArray(target)) {
            run(deps.get(ITERATE_KEY));
            if (isMap(target)) {
              run(deps.get(MAP_KEY_ITERATE_KEY));
            }
          }
          break;
      }
    }
    resetScheduling();
  }
}

function trackRefValue(target: object): void {
  track(target, TrackOpTypes.GET, "value");
}

function triggerRefValue(target: object, newValue: any, oldValue: any): void {
  trigger(target, TriggerOpTypes.SET, "value", newValue, oldValue);
}

export {
  trigger,
  track,
  triggerRefValue,
  trackRefValue,
  Dep,
  getTargetReactiveProxyDeps,
};
