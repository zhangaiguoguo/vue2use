import {
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  ITERATE_KEY,
  makeMap,
} from "./shared";
import { arrayInstrumentations } from "./arrayInstrumentations";
import { track, trigger } from "./dep";
import warn from "./warning";
import {
  isReadonly,
  isRef,
  isShallow,
  reactive,
  readonly,
  Target,
  toRaw,
} from "./reactive";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./operations";

const reactiveProxyMap: WeakMap<object, object> = new WeakMap();

const shallowReadonlyMap: WeakMap<object, object> = new WeakMap();

const shallowReactiveMap: WeakMap<object, object> = new WeakMap();

const readonlyMap: WeakMap<object, object> = new WeakMap();

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .filter((key) => key !== "arguments" && key !== "caller")
    //@ts-ignore
    .map((key) => Symbol[key])
    .filter(isSymbol)
);

const isNonTrackableKeys = makeMap(`__proto__,__v_isRef,__isVue`);

function hasOwnProperty(this: object, key: any) {
  if (!isSymbol(key)) key = String(key);
  const obj = toRaw(this);
  track(obj, TrackOpTypes.GET, key);
  return obj.hasOwnProperty(key);
}

class BaseReactiveHandler implements ProxyHandler<Target> {
  constructor(
    protected readonly _isReadonly = false,
    protected readonly _isShallow = false
  ) {}

  get(target: Target, key: string | string, receiver: Target): unknown {
    if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP];

    const isReadonly2 = this._isReadonly,
      isShallow2 = this._isShallow;
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly2;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly2;
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow2;
    } else if (key === ReactiveFlags.RAW) {
      if (
        receiver ===
          (isReadonly2
            ? isShallow2
              ? shallowReadonlyMap
              : readonlyMap
            : isShallow2
            ? shallowReactiveMap
            : reactiveProxyMap
          ).get(target) ||
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)
      ) {
        return target;
      }
      return;
    }
    const targetIsArray = isArray(target);
    if (!isReadonly2) {
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (key === "hasOwnProperty") {
        return hasOwnProperty;
      }
    }
    const res = Reflect.get(target, key, receiver);
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly2) {
      track(target, TrackOpTypes.GET, key);
    }
    if (isShallow2) {
      return res;
    }
    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value;
    }
    if (isObject(res)) {
      return isReadonly2 ? readonly(res) : reactive(res);
    }
    return res;
  }
}

class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(_isShallow?: boolean) {
    super(false, _isShallow);
  }

  set(
    target: Record<string | symbol, unknown>,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    //@ts-ignore
    let oldValue = target[key];
    if (!this._isShallow) {
      const isOldValueReadonly = isReadonly(oldValue);
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue);
        value = toRaw(value);
      }
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          return false;
        } else {
          oldValue.value = value;
          return true;
        }
      }
    }
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key);
    const result = Reflect.set(target, key, value, receiver);
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
      }
    }
    return result;
  }

  deleteProperty(
    target: Record<string | symbol, unknown>,
    key: string | symbol
  ): boolean {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, void 0, oldValue);
    }
    return result;
  }

  has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
    const result = Reflect.has(target, key);

    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key);
    }
    return result;
  }

  ownKeys(target: Record<string | symbol, unknown>): (string | symbol)[] {
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  }
}

class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(true, isShallow2);
  }

  set(target: object, key: string | symbol) {
    if (process.env.NODE_ENV !== "production") {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  }

  deleteProperty(target: object, key: string | symbol) {
    if (process.env.NODE_ENV !== "production") {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  }
}

export const readonlyHandlers: ReadonlyReactiveHandler =
  new ReadonlyReactiveHandler();

export const shallowReactiveHandlers: MutableReactiveHandler =
  new MutableReactiveHandler(true);
export const shallowReadonlyHandlers: ReadonlyReactiveHandler =
  new ReadonlyReactiveHandler(true);

export const mutableReactiveHandler: MutableReactiveHandler =
  new MutableReactiveHandler();

export {
  reactiveProxyMap,
  shallowReadonlyMap,
  readonlyMap,
  shallowReactiveMap,
  MutableReactiveHandler,
  ReadonlyReactiveHandler,
  BaseReactiveHandler,
};
