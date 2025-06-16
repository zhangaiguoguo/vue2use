import { hasChanged, isFunction } from "./shared";
import { Target, toRaw, toReactive } from "./reactive";
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

// new RefImpl({a: 1}).value.a

class ObjectRefImpl<T extends any, K extends keyof T> extends RefImplCommon {
  public _object: T;
  public _key: K;
  public _value: K extends keyof T ? T[K] : any;
  public _defaultValue: any;

  constructor(object: T, key: K, defaultValue?: any, shallow?: boolean) {
    super(shallow);
    this._object = object;
    this._key = key;
    this._value = Reflect.get(object as object, key);
    this._defaultValue = defaultValue;
  }

  get value(): K extends keyof T ? T[K] : any {
    const value = this._object[this._key];
    const returnValue = value === void 0 ? this._defaultValue : value;
    return this[ReactiveFlags.IS_SHALLOW]
      ? toRaw(returnValue)
      : toReactive(returnValue);
  }

  set value(v: K extends keyof T ? T[K] : any) {
    this._object[this._key] = v;
  }
}

// new ObjectRefImpl({a: 1}, "a").value

type CustomRefFactory<T> = (
  track: () => void,
  trigger: (a?: T, b?: T | void) => void
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

// const count = new CustomRef(() => {
//     let num = {
//         a: 1,
//         b: 2
//     };
//     return {
//         get() {
//             return num;
//         },
//         set(v) {
//             num = v;
//         }
//     }
// })
//
// count.value.a

export { CustomRef, RefImpl, ObjectRefImpl, type CustomRefFactory };
