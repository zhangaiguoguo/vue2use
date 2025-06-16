import type { ComponentInstance } from "vue/types/index";

export let currentInstance: ComponentInstance | null = null;

export function getCurrentInstance(): { proxy: ComponentInstance } | null {
  return (
    currentInstance && {
      proxy: currentInstance,
    }
  );
}

export function setCurrentInstance(vm: ComponentInstance | null | void): void {
  if (vm === void 0) {
    vm = null;
  }
  currentInstance = vm;
}
