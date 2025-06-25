import Vue from "vue";
import type { ComponentInstance } from "vue/types/index";
import { currentInstance } from "./currentInstance";
import { hasOwn, isFunction } from "../shared";

interface InjectionKey<T> extends Symbol {}

export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    {
      Vue.util.warn("provide() can only be used inside setup().");
    }
  } else {
    //@ts-ignore
    resolveProvided(currentInstance)[key] = value;
  }
}

function resolveProvided(vm: ComponentInstance): Record<string, any> {
  //@ts-ignore
  vm._provided ??= {};
  //@ts-ignore
  const existing = vm._provided;
  //@ts-ignore
  const parentProvides = vm.$parent && vm.$parent._provided;
  if (parentProvides === existing) {
    //@ts-ignore
    return (vm._provided = Object.create(parentProvides));
  } else {
    return existing;
  }
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined;

export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T;

export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T;

export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  if (treatDefaultAsFactory === void 0) {
    treatDefaultAsFactory = false;
  }
  const instance = currentInstance;
  if (instance) {
    //@ts-ignore
    let provides = null;
    let source = instance.$parent;
    while (source) {
      let _provides = provides;
      //@ts-ignore
      if ((_provides = source._provided) && hasOwn(_provides, key)) {
        provides = _provides;
        break;
      }
      source = source.$parent;
    }
    //@ts-ignore
    if (provides && key in provides) {
      return provides[key as any];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance)
        : defaultValue;
    } else {
      Vue.util.warn('injection "'.concat(String(key), '" not found.'));
    }
  } else {
    Vue.util.warn(
      "inject() can only be used inside setup() or functional components."
    );
  }
}
