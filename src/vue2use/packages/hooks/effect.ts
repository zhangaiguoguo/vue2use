import type { ComponentInstance } from "vue/types/index";
import { EffectScope, Watcher } from "../reactivity";
import { NOOP } from "../shared";
import { currentInstance } from "./currentInstance";
import vm from "../vm";

declare module "vue/types/vue" {
  interface Vue {
    _scope?: EffectScope;
  }
}

export const effectScope = function (vm2: ComponentInstance): EffectScope {
  const scope = new EffectScope(false);
  if (vm2 && vm2._scope) {
    vm2._scope.scopes ??= [];
    vm2._scope.scopes.push(scope);
    //@ts-ignore
    scope.parent ??= vm2._scope;
  }
  return scope;
};

export function effect(fn: () => any, scheduler?: (cb: any) => void) {
  const watcher = new Watcher(currentInstance || vm, fn, NOOP, {
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
