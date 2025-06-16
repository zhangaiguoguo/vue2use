import {
  hasChanged,
  isArray,
  isIntegerKey,
  isObject,
  toRawType,
} from "./shared";
import vm from "../vm";
import Vue from "vue";
import warning from "./warning";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./operations";
import { Dep } from "./dep";
import { DebuggerEventExtraInfo } from "./debug";

const { $data } = vm,
  ObserverV2 = $data[ReactiveFlags.OB].constructor;

interface Observer<T> {
  value: T;
  shallow: boolean;
  mock: boolean;
  [ReactiveFlags.DEP]: Dep;
}

type ObserverImplValueBase = (Record<any, any> | any[]) & {
  [key: string | number | symbol]: any;
};

type ObserverImplValue<T> = ObserverImplValueBase & {
  [ReactiveFlags.OB]?: Observer<T>;
};

const observerMap = new WeakMap<object, ObserverImpl<ObserverImplValue<any>>>();

class ObserverImpl<T extends ObserverImplValueBase> {
  private readonly observer: Observer<T> | void = void 0;
  private readonly dep!: Dep;
  constructor(readonly value: T, shallow = false, mock = false) {
    if (observerMap.has(value)) {
      return observerMap.get(value) as ObserverImpl<T>;
    }
    if ((value as ObserverImplValue<T>)[ReactiveFlags.OB]) {
      this.observer = (value as ObserverImplValue<T>)[ReactiveFlags.OB];
    } else {
      this.observer = new ObserverV2(value, shallow, mock);
    }
    this.dep = (this.observer as Observer<T>)[ReactiveFlags.DEP];
    observerMap.set(value, this);
  }

  get<K extends keyof T>(
    key: K
  ): T[K] extends ObserverImplValueBase ? ObserverImpl<T[K]> : T[K];

  get(): T;

  get(key?: any) {
    if (arguments.length === 0) {
      this.depend({
        type: TrackOpTypes.GET,
        key: "",
        target: this.value,
      });
      return this.value;
    }
    if (isArray(this.value) && !isIntegerKey(key)) {
      this.depend({
        type: TrackOpTypes.GET,
        key: key,
        target: this.value,
      });
    }
    const res = this.value[key];
    return isObject(res)
      ? new ObserverImpl(
          res,
          (this.observer as Observer<T>).shallow,
          (this.observer as Observer<T>).mock
        )
      : res;
  }

  set<T>(key: string | symbol | number, value: any) {
    const oldValue = this.value[key];
    this.value[key as keyof T] = value;
    if (isArray(this.value) && !isIntegerKey(key)) {
      this.notify({
        type: TriggerOpTypes.SET,
        key,
        target: this.value,
        newValue: value,
        oldValue: oldValue,
      });
    }
    return this;
  }

  notify(info: DebuggerEventExtraInfo) {
    this.dep.notify(info);
    return this;
  }

  depend(info: DebuggerEventExtraInfo) {
    this.dep.depend(info);
    return this;
  }

  delete(key: string | string | number) {
    Vue.delete(this.value, key as string);
    return this;
  }

  add(key: string | string | number, value: unknown) {
    Vue.set(this.value, key as string, value);
    return this;
  }

  replaceState<T2 extends T>(newValue: T2) {
    if (newValue) {
      if (newValue === this.value) {
        return this;
      }
      if (toRawType(newValue) !== toRawType(this.value)) {
        return warning(
          newValue,
          "The type does not match the original value",
          this.value
        );
      }
      if (isArray(newValue)) {
        this.value.length = newValue.length;
        for (let i = 0; i < newValue.length; i++) {
          if (hasChanged(this.value[i], newValue[i])) {
            this.value.splice(i, 1, newValue[i]);
          }
        }
      } else {
        //@ts-ignore
        for (let key in newValue) {
          if (key in this.value) {
            this.set(key, newValue[key]);
          } else {
            this.add(key, newValue[key]);
          }
        }
        {
          for (let key in this.value) {
            if (!(key in newValue)) {
              this.delete(key);
            }
          }
        }
      }
      this.notify({
        type: TriggerOpTypes.SET,
        key: "",
        target: this.value,
      });
    }
    return this;
  }
}

function observer<T extends ObserverImplValueBase>(target: T) {
  return new ObserverImpl(target);
}

// observer({ a: { a: 1, b: { cc: 1 } }, b: function () {} }).get("a").get("b").value.cc

export { ObserverImpl, observer };
