import { hasChanged, IfAny, isFunction, isObject } from "./shared";
import {
  isReactive,
  Target,
  toRaw,
  toReactive,
  type Builtin,
  type ShallowReactiveMarker,
} from "./reactive";
import {
  Dep,
  getTargetReactiveProxyDeps,
  track,
  trackRefValue,
  trigger,
  triggerRefValue,
} from "./dep";
import warn from "./warning";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./operations";
import { ComputedRef, WritableComputedRef } from "./computed";

declare const RefSymbol: unique symbol;
export declare const RawSymbol: unique symbol;

export interface Ref<T = any, S = T> {
  get value(): T;

  set value(_: S);

  dep: Dep | void;

  [RefSymbol]: true;
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>;

export type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>;
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

class RefImplCommon implements Target {
  readonly [ReactiveFlags.IS_SHALLOW]: boolean;
  readonly [ReactiveFlags.IS_REF] = true;

  constructor(shallow?: boolean) {
    this[ReactiveFlags.IS_SHALLOW] = !!shallow;
  }
}

class RefImpl<T, S = T> extends RefImplCommon {
  public _rawValue: any;
  public _value: any;

  constructor(value?: T, shallow?: boolean) {
    super(shallow);
    this._rawValue = value;
    this._value = value;
  }

  get value(): T {
    trackRefValue(this);
    return this[ReactiveFlags.IS_SHALLOW]
      ? toRaw(this._value)
      : toReactive(this._value);
  }

  set value(v: S) {
    if (!hasChanged(v, this._value)) {
      return;
    }
    const oldValue = this._value;
    this._value = v;
    triggerRefValue(this, v, oldValue);
    return;
  }

  get dep(): Dep | void {
    const deps = getTargetReactiveProxyDeps(this);
    return deps && deps.get("value");
  }
}

class GetterRefImpl<T> {
  public readonly [ReactiveFlags.IS_REF] = true;
  public readonly [ReactiveFlags.IS_READONLY] = true;
  public _value: T = undefined!;

  constructor(private readonly _getter: () => T) {}
  get value() {
    return (this._value = this._getter());
  }
}

class ObjectRefImpl<T extends object, K extends keyof T> extends RefImplCommon {
  public _value: K extends keyof T ? T[K] : any;

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K],
    shallow?: boolean
  ) {
    super(shallow);
    this._value = Reflect.get(_object as object, _key);
  }

  get value() {
    const value = this._object[this._key];
    const returnValue =
      (value === void 0) === this._value ? this._defaultValue : value;
    return this[ReactiveFlags.IS_SHALLOW] ? toRaw(returnValue) : returnValue;
  }

  set value(v) {
    this._object[this._key] = v as T[K];
  }

  get dep(): Dep | void {
    const deps = getTargetReactiveProxyDeps(this._object);
    return deps && deps.get(this._key);
  }
}

export type CustomRefFactory<T> = (
  track: () => void,
  trigger: (newVal?: T, oldValue?: T | void) => void
) => {
  get: () => T;
  set: (value: T) => void;
};

class CustomRef<T> extends RefImplCommon {
  //@ts-ignore
  public _getter: ReturnType<CustomRefFactory<T>>["get"];
  //@ts-ignore
  public _setter: ReturnType<CustomRefFactory<T>>["set"];

  constructor(factory: CustomRefFactory<T>) {
    super(false);
    const result = factory(
      () => {
        track(this, TrackOpTypes.GET, "value");
      },
      (newValue, oldValue) => {
        trigger(this, TriggerOpTypes.SET, "value", newValue, oldValue);
      }
    );
    const getter = result && result.get;
    const setter = result && result.set;
    if (!isFunction(getter) || !isFunction(setter)) {
      warn(
        "CustomRef factory(onTrack, onTrigger) -> return result get Function and set Function"
      );
      //@ts-ignore
      return {};
    }
    this._getter = getter;
    this._setter = setter;
  }

  get dep(): Dep | void {
    const deps = getTargetReactiveProxyDeps(this);
    return deps && deps.get("value");
  }

  get value(): T {
    return this._getter();
  }

  set value(v: T) {
    this._setter(v);
  }
}

export function shallowRef<T>(value: T): RefImpl<T> {
  return new RefImpl(value, true);
}

export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRef(factory) as unknown as Ref<T>;
}

export function isRef<T>(target: Ref<T> | unknown): target is Ref<T> {
  return !!(isObject(target) && ReactiveFlags.IS_REF in (target as Target));
}

export function unref<T>(ref: MaybeRef<T> | ComputedRef<T>): T {
  return isRef(ref) ? ref.value : ref;
}

export function triggerRef(ref2: Ref): void {
  if (isRef(ref2)) {
    triggerRefValue(ref2, ref2.value, ref2.value);
  }
}

export interface RefUnwrapBailTypes {}

export type ShallowUnwrapRef<T> = {
  [K in keyof T]: DistributeRef<T[K]>;
};

type DistributeRef<T> = T extends Ref<infer V, unknown> ? V : T;

export type UnwrapRef<T> = T extends ShallowRef<infer V, unknown>
  ? V
  : T extends Ref<infer V, unknown>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>;

export type UnwrapRefSimple<T> = T extends
  | Builtin
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  | { [RawSymbol]?: true }
  ? T
  : T extends Map<infer K, infer V>
  ? Map<K, UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Map<any, any>>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<K, UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof WeakMap<any, any>>>
  : T extends Set<infer V>
  ? Set<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Set<any>>>
  : T extends WeakSet<infer V>
  ? WeakSet<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof WeakSet<any>>>
  : T extends ReadonlyArray<any>
  ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
  : T extends object & { [ShallowReactiveMarker]?: never }
  ? {
      [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>;
    }
  : T;

export function toRef<T>(
  value: T
): T extends () => infer R
  ? Readonly<Ref<R>>
  : T extends Ref
  ? T
  : Ref<UnwrapRef<T>>;
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]>;
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>;
export function toRef(
  source: Record<string, any> | MaybeRef,
  key?: string,
  defaultValue?: unknown
): Ref {
  if (isRef(source)) {
    return source;
  } else if (isFunction(source)) {
    return new GetterRefImpl(source) as any;
  } else if (isObject(source) && arguments.length > 1) {
    return propertyToRef(source, key!, defaultValue);
  } else {
    return ref(source);
  }
}

function propertyToRef(
  source: Record<string, any>,
  key: string,
  defaultValue?: unknown
) {
  const val = source[key];
  return isRef(val)
    ? val
    : (new ObjectRefImpl(source, key, defaultValue) as any);
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

export function ref<T>(target?: T): Ref<T> {
  return new RefImpl<T>(target) as unknown as Ref<T>;
}

export function toValue<T>(source: MaybeRefOrGetter<T>): T {
  return isFunction(source) ? source() : unref(source);
}
