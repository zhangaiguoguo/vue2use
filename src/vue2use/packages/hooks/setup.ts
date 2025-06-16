import {
  readonly,
  reactive,
  isRef,
  unref,
  EffectScope,
  track,
  proxyRefs,
  markRaw,
  shallowReadonly,
  watch,
  ref,
  customRef,
  watchSyncEffect,
  watchPostEffect,
} from "../reactivity/index";
import Vue from "vue";
import {
  hasChanged,
  isFunction,
  isObject,
  NOOP,
  getOwnPropertyDescriptor,
  removeArrayItem,
  isArray,
  hasOwn,
  EMPTY_OBJ,
  camelize,
  hyphenate,
  inBrowser,
} from "../shared";
import { onBeforeMount, onUnmounted } from "./lifeCycle";
import { callHooks, clearVmCallHooks } from "./vmCallHooksCaches";
import {
  currentInstance,
  getCurrentInstance,
  setCurrentInstance,
} from "./currentInstance";
import type { ComponentInstance, VNode } from "vue/types/index";
import { TrackOpTypes } from "../reactivity/operations";

export interface SetupContext {
  attrs: Record<string, any>;
  slots: Record<string, (state?: any) => VNode[]>;
  listeners: Record<string, Function | Function[]>;
  emit: (event: string, ...args: any[]) => any;
  expose: (exposed: Record<string, any>) => void;
}

declare module "vue/types/vue" {
  interface Vue {
    setupContext?: SetupContext;
  }
}

const publicPropertiesMap = Vue.util.extend(Object.create(null), {
  $: (i: ComponentInstance) => i,
  $el: (i: ComponentInstance) => i.$el || i.$vnode.elm,
  $data: (i: ComponentInstance) => i.$data,
  $props: (i: ComponentInstance) => shallowReadonly(i.$props),
  $attrs: (i: ComponentInstance) => shallowReadonly(i.$attrs),
  $slots: (i: ComponentInstance) => shallowReadonly(i.$slots),
  $refs: (i: ComponentInstance) => shallowReadonly(i.$refs),
  $parent: (i: ComponentInstance) => i.$parent,
  $root: (i: ComponentInstance) => i.$root,
  $emit: (i: ComponentInstance) => i.$emit,
  $on: (i: ComponentInstance) => i.$on,
  $off: (i: ComponentInstance) => i.$off,
  $once: (i: ComponentInstance) => i.$once,
  $options: (i: ComponentInstance) => i.$options,
  $forceUpdate: (i: ComponentInstance) => i.$forceUpdate.bind(i),
  //@ts-ignore
  $nextTick: (i: ComponentInstance) => i.n || (i.n = i.$nextTick.bind(i)),
  $watch: (i: ComponentInstance) => i.$watch.bind(i),
});

function patchObjectBoth(
  obj1: Record<any, any> | null,
  obj2: Record<any, any> | null,
  callback?: (key: string) => any
) {
  if (obj1 === obj2 || obj1 === null || (obj2 === null && obj1 == obj2)) {
    return;
  }
  obj1 ??= {};
  obj2 ??= {};
  const obj2Keys = [];
  for (const key in obj1) {
    if (key in obj2) {
      if (hasChanged(obj1[key], obj2[key])) {
        obj2[key] = callback ? callback(key) : obj1[key];
      }
    } else {
      obj2[key] = callback ? callback(key) : obj1[key];
    }
    obj2Keys.push(key);
  }
  for (const key in obj2) {
    if (obj2Keys.indexOf(key) === -1) {
      delete obj2[key];
    }
  }
  return obj2;
}

function patchProps(
  newProps: Record<any, any> | null,
  oldProps: Record<any, any> | null
) {
  return patchObjectBoth(newProps, oldProps);
}

function definePropsReactive(propsData: Record<string, any>) {
  return readonly(propsData);
}

function defineVmOptionsProxy<T extends Record<any, any>>(
  options: T,
  get: (target: T, key: any, receiver: T) => void,
  set: (target: T, key: any, value: unknown, receiver: T) => void
) {
  let l: T;
  return (l = new Proxy(options, {
    get(target, key, receiver) {
      get && get(target, key, receiver);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      Reflect.set(target, key, value, receiver);
      set && set(target, key, value, receiver);
      return true;
    },
    has(target, key) {
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    defineProperty(target, key, descriptor) {
      return Reflect.defineProperty(target, key, descriptor);
    },
    deleteProperty(target, key) {
      set && set(target, key, void 0, l);
      return Reflect.deleteProperty(target, key);
    },
  }));
}

function defineInstanceSetupState(
  setupState: Record<string, any> | void,
  vm?: ComponentInstance
) {
  vm ??= currentInstance as ComponentInstance;
  if (isObject(setupState)) {
    //@ts-ignore
    const state = Vue.util.extend(vm._setupState, setupState);
    for (const key in state) {
      if (key in vm) {
        Vue.util.warn(
          `setupState key ${key} is already defined in vm, it will be overwritten`
        );
      }
      if (isFunction(state[key])) {
        //@ts-ignore
        vm[key] = state[key];
      } else {
        Object.defineProperty(vm, key, {
          get() {
            return unref(state[key]);
          },
          set(value) {
            const oldValue = state[key];
            if (isRef(oldValue)) {
              oldValue.value = value;
            } else {
              Vue.util.warn(
                `setupState key ${key} is not a ref, it will not be reactive`
              );
              state[key] = value;
            }
          },
          enumerable: true,
          configurable: true,
        });
      }
    }
  }
}

function createSetupContext(instance: ComponentInstance): SetupContext {
  const expose = (exposed?: Record<string, any>) => {
    if (process.env.NODE_ENV !== "production") {
      //@ts-ignore
      if (instance._isExpose) {
        Vue.util.warn(`expose() should be called only once per setup().`);
      }
      if (exposed != null) {
        let exposedType: string = typeof exposed;
        if (exposedType === "object") {
          if (isArray(exposed)) {
            exposedType = "array";
          } else if (isRef(exposed)) {
            exposedType = "ref";
          }
        }
        if (exposedType !== "object") {
          Vue.util.warn(
            `expose() should be passed a plain object, received ${exposedType}.`
          );
        }
      }
    }
    defineVmExpose(instance, exposed);
  };
  let attrsProxy: SetupContext["attrs"];
  let slotsProxy: SetupContext["slots"];
  return Object.freeze({
    get attrs() {
      return attrsProxy || (attrsProxy = defineVmAttrs(instance));
    },
    get slots() {
      return slotsProxy || (slotsProxy = defineVmSlots(instance));
    },
    get emit() {
      return (event: string, ...args: any[]) => instance.$emit(event, ...args);
    },
    get listeners() {
      return instance.$listeners;
    },
    expose,
  });
}

function defineVmAttrs(vm: ComponentInstance): SetupContext["attrs"] {
  const attrs = vm.$attrs;
  watch(
    () => vm.$attrs,
    (value) => {
      patchObjectBoth(value, attrs);
      // trigger(vm, "set", "$attrs");
    },
    {
      flush: "sync",
    }
  );
  let set$;
  return new Proxy(
    attrs,
    Vue.util.extend(
      {
        get(target: any, key: any) {
          // track(vm, "get", "$attrs");
          return vm.$attrs[key];
        },
      },
      process.env.NODE_ENV !== "production"
        ? {
            set: (set$ = function (target: any, key: any) {
              Vue.util.warn(
                `attrs is readonly, you cannot set \`${key}\` attribute`
              );
              return true;
            }),
            deleteProperty: set$,
          }
        : void 0
    )
  );
}

function defineVmSlots(vm: ComponentInstance): SetupContext["slots"] {
  //@ts-ignore
  let scopedSlots = vm.$options._parentVnode?.data?.scopedSlots || {};
  const slots = new Proxy(scopedSlots, {
    get(target, key, receiver) {
      track(vm, TrackOpTypes.GET, "$slots");
      const fn = Reflect.get(target, key, receiver);
      if (fn) {
        //@ts-ignore
        return (props: Record<any, any>) => vm._t(key, void 0, props, void 0);
      }
      return void 0;
    },
  });

  let {
    value: $slots,
    get,
    set,
  } = getOwnPropertyDescriptor(vm, "$slots") as TypedPropertyDescriptor<
    Record<string, VNode[]>
  >;

  Object.defineProperty(vm, "$slots", {
    get: get || (() => $slots),
    set(value) {
      if (set) {
        set.call(this, value);
      } else {
        $slots = value;
      }
      //@ts-ignore
      let currentScopedSlots = vm.$options._parentVnode?.data?.scopedSlots;
      if (currentScopedSlots !== scopedSlots) {
        scopedSlots = currentScopedSlots;
        patchObjectBoth(scopedSlots, slots);
      }
    },
  });

  return slots;
}

function registerRef(vnode: VNode, isRemoval = false) {
  //@ts-ignore
  const ref = vnode.data.ref.originRef;
  if (ref == null) return;
  const vm = vnode.context as ComponentInstance;
  //@ts-ignore
  const refValue = vnode.componentInstance?._exposeState;
  const value = isRemoval ? null : refValue;
  const $refsValue = isRemoval ? undefined : refValue;
  if (isFunction(ref)) {
    ref(value);
    return;
  }
  //@ts-ignore
  const isFor = vnode.data.refInFor;
  const _isString = typeof ref === "string" || typeof ref === "number";
  const _isRef = isRef(ref);
  const refs = vm.$refs;
  if (_isString || _isRef) {
    if (isFor) {
      const existing = _isString ? refs[ref] : ref.value;
      if (isRemoval) {
        isArray(existing) && removeArrayItem(existing, refValue);
      } else {
        if (!isArray(existing)) {
          if (_isString) {
            refs[ref] = [refValue];
            setSetupRef(vm, ref, refs[ref]);
          } else {
            ref.value = [refValue];
          }
        } else if (!existing.includes(refValue)) {
          existing.push(refValue);
        }
      }
    } else if (_isString) {
      if (isRemoval && refs[ref] !== refValue) {
        return;
      }
      refs[ref] = $refsValue;
      setSetupRef(vm, ref, value);
    } else if (_isRef) {
      if (isRemoval && ref.value !== refValue) {
        return;
      }
      ref.value = value;
    } else if (process.env.NODE_ENV !== "production") {
      Vue.util.warn("Invalid template ref type: ".concat(typeof ref));
    }
  }
}

function setSetupRef(_a: any, key: any, val: any) {
  const _setupState = _a._setupState;
  if (_setupState && hasOwn(_setupState, key)) {
    if (isRef(_setupState[key])) {
      _setupState[key].value = val;
    } else {
      _setupState[key] = val;
    }
  }
}

const patchVNodeRefPrevRecordCaches = new WeakMap();

function patchVNodeRef(vm: ComponentInstance) {
  //@ts-ignore
  const _parentVNode = vm.$options._parentVnode;
  if (_parentVNode) {
    const data = _parentVNode.data;
    let rco;
    if ((rco = patchVNodeRefPrevRecordCaches.get(vm))) {
      if (rco.refFn.originRef === data.ref) {
        data.ref = rco.refFn;
        rco.node = _parentVNode;
        return;
      } else {
        rco.refFn(null);
        rco.refFn.originRef = void 0;
        patchVNodeRefPrevRecordCaches.delete(vm);
      }
    }
    if ("ref" in data) {
      let oo;
      patchVNodeRefPrevRecordCaches.set(
        vm,
        (oo = {
          node: _parentVNode,
          refFn: (v: any) => {
            registerRef(_parentVNode, v === null);
          },
        })
      );
      const o = data.ref;
      data.ref = oo.refFn;
      data.ref.originRef = o;
    }
  }
}

function defineVmExpose(
  instance: ComponentInstance,
  exposeState?: Record<any, any>
) {
  exposeState ??= {};
  //@ts-ignore
  instance._isExpose = true;
  // patchVNodeRef(instance);
  //@ts-ignore
  instance._exposeState = new Proxy(proxyRefs(markRaw(exposeState)), {
    get(target, key: any) {
      if (key in target) {
        return target[key];
      } else if (key in publicPropertiesMap) {
        return publicPropertiesMap[key](instance);
      }
    },
    has(target, key) {
      return key in target || key in publicPropertiesMap;
    },
  });
}

function useSlots(): SetupContext["slots"] {
  return getContext()?.slots as SetupContext["slots"];
}

function useAttrs(): SetupContext["attrs"] {
  return getContext()?.attrs as SetupContext["attrs"];
}

function getContext() {
  const i = getCurrentInstance();
  if (!i) {
    Vue.util.warn(`useContext() called without active instance.`);
    return;
  }
  const { proxy } = i;
  return proxy.setupContext || (proxy.setupContext = createSetupContext(proxy));
}

function useModel<T extends Record<any, any>, K extends keyof T, T2 = T[K]>(
  props: T,
  name: K,
  options = EMPTY_OBJ
) {
  const i = getCurrentInstance();
  if (!i) {
    Vue.util.warn(`useModel() called without active instance.`);
    return ref();
  }
  const { proxy } = i;
  const camelizedName = camelize(name as string);
  const propsOptions =
    //@ts-ignore
    proxy.$options?._propKeys || Object.keys(proxy._props) || [];
  if (!propsOptions.includes(camelizedName)) {
    Vue.util.warn(
      `useModel() called with prop "${name as string}" which is not declared.`
    );
    return ref();
  }
  const hyphenatedName = hyphenate(name as string);
  const res = customRef<T2>((track2, trigger2) => {
    let localValue: T2 | void;
    let prevSetValue: any = EMPTY_OBJ;
    let prevEmittedValue: T2 | void;
    watchSyncEffect(() => {
      const propValue = props[camelizedName];
      if (hasChanged(localValue, propValue)) {
        localValue = propValue;
        trigger2();
      }
    });
    return {
      get() {
        track2();
        return options.get ? options.get(localValue) : localValue;
      },
      set(value: T2) {
        const emittedValue = options.set ? options.set(value) : value;
        if (
          !hasChanged(emittedValue, localValue) &&
          !(prevSetValue !== EMPTY_OBJ && hasChanged(value, prevSetValue))
        ) {
          return;
        }
        const rawProps = proxy.$props;
        if (
          !(
            rawProps &&
            (name in rawProps ||
              camelizedName in rawProps ||
              hyphenatedName in rawProps) &&
            (`onUpdate:${name as string}` in rawProps ||
              `onUpdate:${camelizedName}` in rawProps ||
              `onUpdate:${hyphenatedName}` in rawProps)
          )
        ) {
          localValue = value;
          trigger2();
        }
        proxy.$emit(`update:${name as string}`, emittedValue);
        if (
          hasChanged(value, emittedValue) &&
          hasChanged(value, prevSetValue) &&
          !hasChanged(emittedValue, prevEmittedValue)
        ) {
          trigger2();
        }
        prevSetValue = value;
        prevEmittedValue = emittedValue;
      },
    };
  });
  return res;
}

function initSetup(this: ComponentInstance) {
  const $options = this.$options || {};
  if ("_setup" in $options) {
    //@ts-ignore
    const scope = (this._vue2SetupScope = new EffectScope(true));
    //@ts-ignore
    this._setupState = {};
    scope.run(() => {
      const setup = $options._setup;
      if (isFunction(setup)) {
        //@ts-ignore
        this.$options = defineVmOptionsProxy(
          $options,
          NOOP,
          (target: any, key: string, value: any) => {
            switch (key) {
              case "propsData":
                patchProps(value, propsReactive);
                break;
              case "_parentVnode":
                //@ts-ignore
                if (this._isExpose) {
                  patchVNodeRef(this);
                }
                break;
            }
          }
        );

        const propsReactive = reactive(this.$options.propsData || {});
        const props = definePropsReactive(propsReactive);
        const setupResult = setup.call(
          { $createElement: this.$createElement.bind(this) },
          props,
          getContext() as SetupContext
        );
        onBeforeMount(() => {
          patchVNodeRef(this);
        });
        if (isFunction(setupResult)) {
          $options.render = (...args: any[]) => {
            const prevInstance = getCurrentInstance();
            try {
              setCurrentInstance(this);
              callHooks(this, "setupRender");
              //@ts-ignore
              return setupResult.call(this, ...args);
            } finally {
              setCurrentInstance(prevInstance?.proxy);
            }
          };
          onUnmounted(() => {
            clearVmCallHooks(this, "setupRender");
          });
        } else {
          defineInstanceSetupState(setupResult);
        }
      } else {
        Vue.util.warn(`setup option is not function`);
      }
    });

    onUnmounted(() => {
      scope.stop();
    });
  }
}

function useCssVars(
  getter: (
    vm: Record<string, any>,
    setupProxy: Record<string, any>
  ) => Record<string, string>
) {
  if (!inBrowser) return;
  const instance = getCurrentInstance();
  if (!instance) {
    Vue.util.warn(
      "useCssVars is called without current active component instance."
    );
    return;
  }
  const { proxy: vm } = instance;
  watchPostEffect(function () {
    const el = vm.$el;
    //@ts-ignore
    const vars = getter(vm, vm._setupState);
    if (el && el.nodeType === 1) {
      //@ts-ignore
      const style = el.style;
      for (let key in vars) {
        style.setProperty("--".concat(key), vars[key]);
      }
    }
  });
}

export { initSetup, useSlots, useAttrs, getContext, useModel, useCssVars };
