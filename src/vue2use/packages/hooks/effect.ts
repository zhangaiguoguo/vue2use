import type { ComponentInstance } from "vue/types/index";
import { EffectScope, Watcher } from "../reactivity";
import { __scope, NOOP } from "../shared";
import { currentInstance } from "./currentInstance";

declare module "vue/types/vue" {
  interface Vue {
    [__scope]?: EffectScope;
  }
}

export const effectScope = function (vm2: ComponentInstance): EffectScope {
  const scope = new EffectScope(false);
  if (vm2 && vm2[__scope]) {
    vm2[__scope].scopes ??= [];
    vm2[__scope].scopes.push(scope);
    //@ts-ignore
    scope.parent ??= vm2[__scope];
  }
  return scope;
};

export function effect(fn: () => any, scheduler?: (cb: any) => void) {
  const watcher = new Watcher(currentInstance, fn, NOOP, {
    sync: true,
  });
  if (scheduler) {
    watcher.update = function () {
      scheduler(function () {
        return watcher.run();
      });
    };
  }
}
