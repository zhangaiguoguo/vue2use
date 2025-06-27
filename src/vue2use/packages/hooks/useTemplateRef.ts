import type { ComponentInstance } from "vue/types/index";
import Vue from "vue";
import { readonly, shallowRef, type ShallowRef } from "../reactivity";
import { getCurrentInstance } from "./currentInstance";
import {
  __isVue,
  def,
  EMPTY_OBJ,
  getOwnPropertyDescriptor,
  isArray,
} from "../shared";

export const knownTemplateRefs: WeakSet<ShallowRef> = new WeakSet();

export type TemplateRef<T = unknown> = Readonly<ShallowRef<T | null>>;

const patchRefValue = (val: any) => {
  if (!val) return val;
  if (val[__isVue] === true) {
    if (val._isExpose) {
      val = val._exposeState;
    }
  }
  return val;
};

export function useTemplateRef<T = unknown, Keys extends string = string>(
  key: Keys
): TemplateRef<T> {
  const i = getCurrentInstance()!.proxy as ComponentInstance;
  const r = shallowRef(null);
  if (i) {
    const refs = i.$refs === EMPTY_OBJ ? ((i as any).$refs = {}) : i.$refs;
    let desc: PropertyDescriptor | undefined;
    if (
      process.env.NODE_ENV !== "production" &&
      (desc = getOwnPropertyDescriptor(refs, key)) &&
      !desc.configurable
    ) {
      Vue.util.warn(`useTemplateRef('${key}') already exists.`);
    } else {
      Object.defineProperty(refs, key, {
        enumerable: true,
        get: () => r.value,
        set: (val) => {
          if (val) {
            if (!isArray(val)) {
              val = patchRefValue(val);
            } else {
              val[0] = patchRefValue(val[0]);
              def(val, "push", (v: any) => {
                return Array.prototype.push.call(val, patchRefValue(v));
              });
            }
          }
          r.value = val;
        },
      });
    }
  } else if (process.env.NODE_ENV !== "production") {
    Vue.util.warn(
      `useTemplateRef() is called when there is no active component ` +
        `instance to be associated with.`
    );
  }
  const ret = process.env.NODE_ENV !== "production" ? readonly(r) : r;
  if (process.env.NODE_ENV !== "production") {
    knownTemplateRefs.add(ret as any);
  }
  return ret as unknown as TemplateRef<T>;
}
