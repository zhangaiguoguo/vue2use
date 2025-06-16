import type { ComponentInstance } from "vue/types/index";

const VmCallHooksCaches = new Map();

function patchCallHook(vm: ComponentInstance, key: string, fn: Function) {
  if (!VmCallHooksCaches.has(vm)) {
    VmCallHooksCaches.set(vm, new Map());
  }
  if (!VmCallHooksCaches.get(vm).has(key)) {
    VmCallHooksCaches.get(vm).set(key, new Set());
  }
  VmCallHooksCaches.get(vm).get(key).add(fn);

  return () => {
    VmCallHooksCaches.get(vm).get(vm).delete(fn);
  };
}

function injectVmCallHook(vm: ComponentInstance, key: string, fn: Function) {
  return patchCallHook(vm, key, fn);
}

function clearVmCallHooks(vm: ComponentInstance, key: string) {
  VmCallHooksCaches.has(vm) && VmCallHooksCaches.get(vm).delete(key);
}

function callHooks(vm: ComponentInstance, key: string, ...args: any[]) {
  if (VmCallHooksCaches.has(vm)) {
    if (VmCallHooksCaches.get(vm).has(key)) {
      const fns = VmCallHooksCaches.get(vm).get(key);
      fns.forEach((fn: Function) => fn.apply(vm, args));
    }
  }
}

export { clearVmCallHooks, injectVmCallHook, callHooks };
