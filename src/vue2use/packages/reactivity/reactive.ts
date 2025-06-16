import { def, isFunction, isObject, toRawType } from "./shared";
import { CustomRef, CustomRefFactory, ObjectRefImpl, RefImpl } from "./ref";
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
import { Dep, triggerRefValue } from "./dep";
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers,
} from "./collectionHandlers";
import { ComputedRef, WritableComputedRef } from "./computed";
import { ReactiveFlags } from "./operations";

export interface Target {
  [ReactiveFlags.SKIP]?: boolean;
  [ReactiveFlags.IS_REACTIVE]?: boolean;
  [ReactiveFlags.IS_READONLY]?: boolean;
  [ReactiveFlags.IS_SHALLOW]?: boolean;
  [ReactiveFlags.RAW]?: any;
}

declare const RefSymbol: unique symbol;

export interface Ref<T = any, S = T> {
  get value(): T;

  set value(_: S);

  dep: Dep | void;

  [RefSymbol]: true;
}

export type ToRefs<T = any> = {
  [K in keyof T]: ObjectRefImpl<T, K>;
};

declare const ShallowRefMarker: unique symbol;
export type ShallowRef<T = any, S = T> = Ref<T, S> & {
  [ShallowRefMarker]?: true;
};

export type MaybeRef<T = any> =
  | T
  | Ref<T>
  | ShallowRef<T>
  | WritableComputedRef<T>;

export type MaybeRefOrGetter<T = any> =
  | MaybeRef<T>
  | ComputedRef<T>
  | (() => T);

export const toReactive: <T extends unknown>(a: T) => T = (value) =>
  isObject(value) ? reactive(value) : value;

export const toReadonly: <T extends unknown>(a: T) => T = (value) =>
  isObject(value) ? readonly(value) : value;

export const toShallow: <T extends unknown>(a: T) => T = (value) => value;

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
}

export function shallowRef<T>(value: T): RefImpl<T> {
  return new RefImpl(value, true);
}

export function customRef<T>(factory: CustomRefFactory<T>): CustomRef<T> {
  return new CustomRef(factory);
}

export function isRef<T>(target: Ref<T> | unknown): target is Ref<T> {
  return !!(isObject(target) && ReactiveFlags.IS_REF in (target as Target));
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
  if (Object.isExtensible(value)) {
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

export function readonly<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
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

export function unref<T>(ref2: MaybeRef<T> | ComputedRef<T>): T {
  return isRef(ref2) ? ref2.value : ref2;
}

export function triggerRef(ref2: Ref): void {
  if (isRef(ref2)) {
    triggerRefValue(ref2, ref2.value, ref2.value);
  }
}

export function toRef<T, K extends keyof T>(
  target: T,
  key: K,
  defaultValue?: any,
  shallow?: boolean
): ObjectRefImpl<T, K> {
  return new ObjectRefImpl(target, key, defaultValue, !!shallow);
}

export function toRefs<T extends object>(target: T): ToRefs<T> {
  if (!isReactive(target)) {
    warn("toRefs ", target, "is not reactive");
  }
  const object = {};
  if (isRef(target)) {
    target = toValue(target as MaybeRefOrGetter<T>);
  }
  if (isObject(target)) {
    for (let k in target) {
      //@ts-ignore
      object[k] = new ObjectRefImpl(target, k, target[k], false);
    }
  } else {
    warn("toRefs argument( target ->", target, " ) for an object");
  }
  //@ts-ignore
  return object;
}

export function ref<T>(target?: T): RefImpl<T> {
  return new RefImpl<T>(target);
}

export function toValue<T>(target: MaybeRefOrGetter<T>): T {
  if (isFunction(target)) {
    //@ts-ignore
    return target();
  }
  if (isRef(target)) {
    return target.value;
  }
  return target as T;
}
