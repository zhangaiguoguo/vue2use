import { hasChanged, isFunction, NOOP } from "./shared";
import { Dep, getTargetReactiveProxyDeps, trackRefValue } from "./dep";
import { Watcher, Watcher as Effect } from "./effect";
import warn from "./warning";
import { Ref, Target } from "./reactive";
import { DebuggerEvent, DebuggerOptions } from "./debug";
import type { ComponentInstance } from "vue/types/index";
import { ReactiveFlags, TriggerOpTypes } from "./operations";
import { currentInstance } from "../hooks/currentInstance";

declare const ComputedRefSymbol: unique symbol;
declare const WritableComputedRefSymbol: unique symbol;

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [ComputedRefSymbol]: true;
  effect: Watcher;
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
  readonly value: T;
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  [WritableComputedRefSymbol]: true;
}

export type ComputedGetter<T> = (oldValue?: T) => T;
export type ComputedSetter<T> = (newValue: T) => void;

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<S>;
}

type ComputedTarget = Target & Record<any, any> & DebuggerOptions;

class ComputedRefImpl<T> implements ComputedTarget {
  readonly effect: Watcher;
  private _value: any;
  readonly [ReactiveFlags.IS_READONLY]: boolean;
  readonly [ReactiveFlags.IS_REF] = true;
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
  constructor(
    private getter: ComputedGetter<T>,
    private setter: ComputedSetter<T> | void,
    vm?: ComponentInstance
  ) {
    this[ReactiveFlags.IS_READONLY] = !setter;
    this.effect = new Effect(vm || currentInstance, this.getter, NOOP, {
      lazy: true,
    });
  }

  get value(): T {
    trackRefValue(this);
    if (this.effect.dirty) {
      this.effect.evaluate();
      this._value = this.effect.value;
      if (hasChanged(this.effect.value, this._value))
        this.dep &&
          this.dep.subs.forEach((dep) => {
            if (dep && dep.onTrigger && process.env.NODE_ENV !== "production") {
              dep.onTrigger({
                type: TriggerOpTypes.SET,
                key: "value",
                target: this,
                effect: this.effect,
                newValue: this.effect.value,
                oldValue: this._value,
              });
            }
          });
    }
    this.effect.depend();
    return this.effect.value;
  }

  set value(newValue: T) {
    if (this.setter) {
      this.setter(newValue);
    } else if (process.env.NODE_ENV !== "production") {
      warn("Write operation failed: computed value is readonly");
    }
  }

  get dep(): Dep | void {
    const deps = getTargetReactiveProxyDeps(this);
    return deps && deps.get("value");
  }
}

export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions
): ComputedRef<T>;

export function computed<T, S = T>(
  options: WritableComputedOptions<T, S>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T, S>;

export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  vm2?: ComponentInstance
) {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T> | undefined;

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  const cRef = new ComputedRefImpl(getter, setter, vm2);

  if (process.env.NODE_ENV !== "production" && debugOptions) {
    cRef.onTrack = debugOptions.onTrack;
    cRef.onTrigger = debugOptions.onTrigger;
  }

  return cRef as any;
}
