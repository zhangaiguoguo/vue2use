import { EffectScope, Watcher } from "../reactivity";
import { NOOP } from "../shared";
import { currentInstance } from "./currentInstance";
import vm from "../vm";

declare module "vue/types/vue" {
  interface Vue {
    _scope?: EffectScope;
  }
}

/**
 * Creates an effect scope object which can capture the reactive effects (i.e.
 * computed and watchers) created within it so that these effects can be
 * disposed together. For detailed use cases of this API, please consult its
 *
 * @param detached - Can be used to create a "detached" effect scope.
 */
export const effectScope = function (): EffectScope {
  const scope = new EffectScope(false);
  return scope;
};

export function effect(fn: () => any, scheduler?: (cb: Function) => void) {
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
