import Vue from "vue";
import { currentInstance, setCurrentInstance } from "./currentInstance";
import { isArray } from "../shared";
import type { ComponentInstance } from "vue/types/index";

function patchInjectVmLifeCycleHooksCaches(
  instance: ComponentInstance,
  key: string,
  fn: () => void
) {
  const callback = () => {
    let previousInstance = currentInstance;
    setCurrentInstance(instance);
    try {
      return fn();
    } catch (e) {
      Vue.util.warn(`instanceLifeCycleHook: ${e}`, instance as any);
    } finally {
      setCurrentInstance(previousInstance);
    }
  };
  const o = (instance.$options as any)[key];
  if (isArray(o)) {
    o.push(callback);
  } else {
    (instance.$options as any)[key] = o ? [o, callback] : [callback];
  }
}

function injectVmLifeCycleHook(
  key: string,
  fn: () => void,
  instance?: ComponentInstance
) {
  if (instance) {
    patchInjectVmLifeCycleHooksCaches(instance, key, fn);
    return;
  }
  if (!currentInstance) {
    Vue.util.warn(
      `injectVmLifeCycleHook: currentInstance is null, key: ${key}, fn: ${fn}`
    );
    return;
  }

  patchInjectVmLifeCycleHooksCaches(currentInstance, key, fn);
}

export function onUpdated(fn: () => void) {
  return injectVmLifeCycleHook("updated", fn);
}

export function onBeforeUnmount(fn: () => void) {
  return injectVmLifeCycleHook("beforeDestroy", fn);
}

export function onUnmounted(fn: () => void) {
  return injectVmLifeCycleHook("destroyed", fn);
}

export function onBeforeUpdate(fn: () => void) {
  return injectVmLifeCycleHook("beforeUpdate", fn);
}

export function onMounted(fn: () => void) {
  return injectVmLifeCycleHook("mounted", fn);
}

export function onBeforeMount(fn: () => void) {
  return injectVmLifeCycleHook("beforeMount", fn);
}

export function onActivated(fn: () => void) {
  return injectVmLifeCycleHook("activated", fn);
}

export function onDeactivated(fn: () => void) {
  return injectVmLifeCycleHook("deactivated", fn);
}

export function onServerPrefetch(fn: () => void) {
  return injectVmLifeCycleHook("serverPrefetch", fn);
}

export function onRenderTracked(fn: () => void) {
  return injectVmLifeCycleHook("renderTracked", fn);
}

export function onRenderTriggered(fn: () => void) {
  return injectVmLifeCycleHook("renderTriggered", fn);
}

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: any,
  info: string
) => boolean | void;

export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target = currentInstance
) {
  //@ts-ignore
  return injectVmLifeCycleHook("errorCaptured", hook, target);
}
