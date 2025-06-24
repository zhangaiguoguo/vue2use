import { def, hasOwn, isObject, toRawType } from "./shared";
import { isRef, Ref, unref, UnwrapRefSimple } from "./ref";
import {
  mutableReactiveHandler,
  reactiveProxyMap,
  readonlyHandlers,
  readonlyMap,
  shallowReactiveHandlers,
  shallowReactiveMap,
  shallowReadonlyHandlers,
  shallowReadonlyMap,
} from "./baseHandler";
import warn from "./warning";
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers,
} from "./collectionHandlers";
import { ReactiveFlags } from "./operations";

export interface Target {
  [ReactiveFlags.SKIP]?: boolean;
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.IS_READONLY]?: boolean;
  [ReactiveFlags.IS_SHALLOW]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

type Primitive = string | number | boolean | bigint | symbol | undefined | null;
export type Builtin = Primitive | Function | Date | Error | RegExp;
export declare const ShallowReactiveMarker: unique symbol;
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>;
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends Ref<infer U, unknown>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : Readonly<T>;

export const toReactive: <T extends unknown>(a: T) => T = (value) =>
  isObject(value) ? reactive(value) : value;

export const toReadonly: <T extends unknown>(a: T) => T = (value) =>
  isObject(value) ? readonly(value) : value;

export const toShallow: <T extends unknown>(a: T) => T = (value) => value;

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
}

export function isReactive(value: any): boolean {
  if (isReadonly(value)) {
    return isReactive(value[ReactiveFlags.RAW]);
  }
  return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}

export function isReadonly(value: any): boolean {
  return !!(value && value[ReactiveFlags.IS_READONLY]);
}

export function isShallow(value: any): boolean {
  return !!(value && value[ReactiveFlags.IS_SHALLOW]);
}

export function isProxy(value: any): boolean {
  return value ? !!value[ReactiveFlags.RAW] : false;
}

export function markRaw<T extends object>(value: T): T {
  if (!hasOwn(value, ReactiveFlags.SKIP) && Object.isExtensible(value)) {
    def(value, ReactiveFlags.SKIP, true);
  }
  return value;
}

enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2,
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case "Object":
    case "Array":
      return TargetType.COMMON;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return TargetType.COLLECTION;
    default:
      return TargetType.INVALID;
  }
}

function getTargetType<T extends any>(value: T) {
  return (value as Target)[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? 0
    : targetTypeMap(toRawType(value));
}

function createReactiveObject<T extends Record<string, any>>(
  target: T,
  isReadonly2: boolean,
  baseHandlers: Record<string, any>,
  collectionHandlers: Record<string, any>,
  proxyMap: WeakMap<Target, any>
): T {
  if (!isObject(target)) {
    warn(`value cannot be made reactive: ${String(target)}`);
    return target;
  }
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly2 && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target;
  }
  const targetType = getTargetType(target);
  if (targetType === 0) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const proxyTarget = new Proxy(
    target,
    targetType === 2 ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxyTarget);
  return proxyTarget;
}

export function reactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    mutableReactiveHandler,
    mutableCollectionHandlers,
    reactiveProxyMap
  );
}

export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}

export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  ) as any;
}

export function shallowReadonly<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}

const shallowUnwrapHandlers = {
  get: (target: any, key: any, receiver: any) =>
    unref(Reflect.get(target, key, receiver)),
  set: (target: any, key: any, value: any, receiver: any) => {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  },
};

export function proxyRefs<T>(objectWithRefs: T): T {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
