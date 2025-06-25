import {
  __isVue,
  hasChanged,
  isArray,
  isFunction,
  isObject,
  isObject2,
  NOOP,
} from "./shared";
import warn from "./warning";
import { isReactive, isShallow, toRaw } from "./reactive";
import {
  Watcher as Effect,
  Watcher,
  activeEffect as activeEffect2,
} from "./effect";
import config from "../vueConfig";
import { Dep } from "./dep";
import { nextTick } from "../hooks/nextTick";
import vm from "../vm";
import { getCurrentInstance } from "../hooks/currentInstance";
import { type ComputedRef } from "./computed";
import type { DebuggerOptions } from "./debug";
import { ReactiveFlags } from "./operations";
import { isRef, type Ref } from "./ref";

export type OnCleanup = (cleanupFn: () => void) => void;

export type WatchEffect = (onCleanup: OnCleanup) => void;

export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any;

export interface WatchOptionsBase extends DebuggerOptions {
  flush?: "pre" | "post" | "sync";
}

export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate;
  deep?: boolean;
  once?: boolean;
}

type MultiWatchSources = (WatchSource<unknown> | object)[];

type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
    ? Immediate extends true
      ? T[K] | undefined
      : T[K]
    : never;
};

export type WatchStopHandle = () => void;

const seenObjects: Set<any> = new Set();
const MAX_UPDATE_COUNT = 100;
const queue: Watcher[] = [];
let has$: Record<number, any> = {};
let circular: Record<number, number> = {};
let waiting = false;
let flushing = false;
let index = 0;
let activeEffect: null | Watcher = null;

function resetSchedulerState() {
  index = queue.length = 0;
  has$ = {};
  if (process.env.NODE_ENV !== "production") {
    circular = {};
  }
  waiting = flushing = false;
}

function queueWatcher(watcher: Watcher) {
  let id = watcher.id;
  if (has$[id] != null) {
    return;
  }
  if (watcher === Dep.target && watcher.noRecurse) {
    return;
  }
  has$[id] = true;
  if (!flushing) {
    queue.push(watcher);
  } else {
    let i = queue.length - 1;
    while (i > index && queue[i].id > watcher.id) {
      i--;
    }
    queue.splice(i + 1, 0, watcher);
  }
  if (!waiting) {
    waiting = true;
    if (process.env.NODE_ENV !== "production" && !config.async) {
      flushSchedulerQueue();
      return;
    }
    nextTick(flushSchedulerQueue);
  }
}

const sortCompareFn = function (a: Watcher, b: Watcher) {
  if (a.post) {
    if (!b.post) return 1;
  } else if (b.post) {
    return -1;
  }
  return a.id - b.id;
};

function flushSchedulerQueue() {
  flushing = true;
  let watcher, id;
  queue.sort(sortCompareFn);
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index];
    if (watcher.before) {
      watcher.before();
    }
    id = watcher.id;
    has$[id] = null;
    watcher.run();
    if (process.env.NODE_ENV !== "production" && has$[id] != null) {
      circular[id] = (circular[id] || 0) + 1;
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          "You may have an infinite update loop " +
            (watcher.user
              ? 'in watcher with expression "'.concat(watcher.expression, '"')
              : "in a component render function."),
          watcher.vm
        );
        break;
      }
    }
  }
  resetSchedulerState();
}

function _traverse(val: any) {
  traverse(val, seenObjects);
  seenObjects.clear();
  return val;
}

export function traverse(val: any, seen: Set<any>): void {
  let i, keys;
  let isA = isArray(val);
  if (
    (!isA && !isObject(val)) ||
    toRaw(val)[ReactiveFlags.SKIP] ||
    Object.isFrozen(val) ||
    (val.constructor.name === "VNode" && val[__isVue] && val.context)
  ) {
    return;
  }
  if (seen.has(val)) {
    return;
  }
  seen.add(val);
  if (isA) {
    i = val.length;
    while (i--) traverse(val[i], seen);
  } else if (isRef(val)) {
    traverse(val.value, seen);
  } else if (isObject2(val)) {
    keys = Object.keys(val);
    i = keys.length;
    while (i--) traverse(val[keys[i]], seen);
  } else {
    try {
      keys = val.keys();
      let cv;
      while ((cv = keys.next()) && cv && !cv.done) {
        traverse(val.get(cv.value), seen);
      }
    } catch {}
  }
}

function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  _a?: WatchOptions | void
): WatchStopHandle {
  let _b = <WatchOptions>(_a === void 0 ? {} : _a),
    immediate = _b.immediate,
    deep = _b.deep,
    once = !!_b.once,
    _c = _b.flush,
    flush = _c === void 0 ? "pre" : _c,
    onTrack = _b.onTrack,
    onTrigger = _b.onTrigger;
  if (process.env.NODE_ENV !== "production" && !cb) {
    if (immediate !== undefined) {
      warn(
        'watch() "immediate" option is only respected when using the ' +
          "watch(source, callback, options?) signature."
      );
    }
    if (deep !== undefined) {
      warn(
        'watch() "deep" option is only respected when using the ' +
          "watch(source, callback, options?) signature."
      );
    }
  }
  const warnInvalidSource = function (s: string) {
    if (process.env.NODE_ENV !== "production")
      warn(
        "Invalid watch source: ".concat(
          s,
          ". A watch source can only be a getter/effect "
        ) + "function, a ref, a reactive object, or an array of these types."
      );
  };

  const instance = getCurrentInstance()?.proxy || vm;

  const call = function (fn: Function, type: string | void | null, args?: any) {
    if (args === void 0) {
      args = null;
    }
    const res = fn.apply(instance, args);
    return res;
  };
  let getter;
  let forceTrigger = false;
  let isMultiSource = false;
  if (isRef(source)) {
    getter = function () {
      return source.value;
    };
    forceTrigger = isShallow(source);
  } else if (isReactive(source)) {
    getter = function () {
      return source;
    };
    deep = true;
  } else if (isArray(source)) {
    isMultiSource = true;
    forceTrigger = source.some(function (s) {
      return isReactive(s) || isShallow(s);
    });
    getter = function () {
      return source.map(function (s) {
        if (isRef(s)) {
          return s.value;
        } else if (isReactive(s)) {
          return _traverse(s);
        } else if (isFunction(s)) {
          return call(s, null);
        } else {
          warnInvalidSource(s);
        }
      });
    };
  } else if (isFunction(source)) {
    if (cb) {
      getter = function () {
        return call(source, null);
      };
    } else {
      getter = function () {
        //@ts-ignore
        if (instance && instance._isDestroyed) {
          return;
        }
        if (cleanup) {
          cleanup();
        }
        return call(source, null, [onCleanup]);
      };
    }
  } else {
    getter = NOOP;
  }
  if (cb && deep) {
    const baseGetter_1 = getter;
    getter = function () {
      return _traverse(baseGetter_1());
    };
  }
  let cleanup: any;
  const onCleanup = function (fn: () => void) {
    cleanup = watcher.onStop = function () {
      call(fn, null);
    };
  };

  const watcher = new Effect(instance, getter, NOOP, {
    lazy: true,
  });

  watcher.noRecurse = !cb;
  let oldValue = isMultiSource ? [] : null;
  watcher.run = function () {
    if (!watcher.active) {
      return;
    }
    const prevActiveEffect = activeEffect;
    activeEffect = watcher;
    (watcher as any).parent = prevActiveEffect;
    try {
      if (cb) {
        const newValue = watcher.get();
        if (
          deep ||
          forceTrigger ||
          (isMultiSource
            ? (newValue as any[]).some(function (v, i) {
                return hasChanged(v, (oldValue as any[])[i]);
              })
            : hasChanged(newValue, oldValue))
        ) {
          if (cleanup) {
            cleanup();
          }
          call(cb, null, [
            newValue,
            oldValue === null ? undefined : oldValue,
            onCleanup,
          ]);
          oldValue = newValue;
        }
      } else {
        watcher.get();
      }
    } finally {
      activeEffect = prevActiveEffect;
    }
  };
  if (flush === "sync") {
    watcher.update = watcher.run;
  } else if (flush === "post") {
    watcher.post = true;
    watcher.update = function () {
      return queueWatcher(watcher);
    };
  } else {
    watcher.update = function () {
      //@ts-ignore
      if (instance && !instance._isMounted && instance !== vm) {
        //@ts-ignore
        const buffer = instance._preWatchers || (instance._preWatchers = []);
        if (buffer.indexOf(watcher) < 0) buffer.push(watcher);
      } else {
        queueWatcher(watcher);
      }
    };
  }
  if (once) {
    const update = watcher.update;
    if (update) {
      watcher.update = function () {
        watcher.teardown();
        update.call(watcher);
      };
    }
  }
  if (process.env.NODE_ENV !== "production") {
    watcher.onTrack = onTrack;
    watcher.onTrigger = onTrigger;
  }
  if (cb) {
    if (immediate) {
      watcher.run();
    } else {
      oldValue = watcher.get();
    }
  } else if (flush === "post" && instance) {
    if (instance === vm) {
      nextTick(() => {
        watcher.get();
      });
    } else {
      instance.$once("hook:mounted", function () {
        return watcher.get();
      });
    }
  } else {
    watcher.get();
  }

  const teardown2 = watcher.teardown;
  watcher.teardown = () => {
    const cleanups = cleanupMap.get(watcher);
    if (cleanups) {
      if (call) {
        cleanups.forEach((cleanup) => {
          call(cleanup, "WATCH_CLEANUP");
        });
      } else {
        for (const cleanup of cleanups) cleanup();
      }
      cleanupMap.delete(watcher);
    }
    teardown2.apply(watcher);
  };

  return () => {
    watcher.teardown();
  };
}

export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle;

// overload: multiple sources w/ `as const`
// watch([foo, bar] as const, () => {})
// somehow [...T] breaks when the type is readonly
export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle;

// overload: single source + cb
export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle;

// overload: watching reactive object w/ cb
export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle;

// implementation
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  if (process.env.NODE_ENV !== "production" && typeof cb !== "function") {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`
    );
  }
  return doWatch(source as any, cb, options);
}

export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle {
  return doWatch(effect, null, options);
}

export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
): WatchStopHandle {
  return doWatch(effect, null, { ...options, flush: "post" });
}

/**
 * @example
 * 
 *   watchSyncEffect(() => {
 *      console.log("This will run synchronously");
 *   },{
 *    onTrack(e) {},
 *    onTrigger(e) {},
 *   });
 * 
 *   var stop = watchSyncEffect(() => {
 *      console.log("This will run synchronously");
 *   });
 *   stop()
*/
export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
): WatchStopHandle {
  return doWatch(effect, null, {
    ...options,
    flush: "sync",
  });
}

const cleanupMap: WeakMap<Watcher, (() => void)[]> = new WeakMap();

/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param cleanupFn - The callback function to attach to the effect's cleanup.
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 * @param owner - The effect that this cleanup function should be attached to.
 * By default, the current active effect.
 */
export function onWatcherCleanup(
  cleanupFn: () => void,
  failSilently = false,
  owner: Watcher | undefined = (activeEffect || activeEffect2) as Watcher
): void {
  if (owner) {
    let cleanups = cleanupMap.get(owner);
    if (!cleanups) cleanupMap.set(owner, (cleanups = []));
    cleanups.push(cleanupFn);
  } else if (process.env.NODE_ENV !== "production" && !failSilently) {
    warn(
      `onWatcherCleanup() was called when there was no active watcher` +
        ` to associate with.`
    );
  }
}

export function getCurrentWatcher() {
  return activeEffect || activeEffect2;
}
