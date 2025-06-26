import {
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
  trigger,
  reactive,
  toRaw,
} from "../reactivity/index";
import Vue from "vue";
import {
  hasChanged,
  isFunction,
  isObject,
  getOwnPropertyDescriptor,
  removeArrayItem,
  isArray,
  hasOwn,
  EMPTY_OBJ,
  camelize,
  hyphenate,
  inBrowser,
  toRawType,
  isObject2,
} from "../shared";
import { onBeforeMount, onUnmounted } from "./lifeCycle";
import {
  currentInstance,
  getCurrentInstance,
  setCurrentInstance,
} from "./currentInstance";
import type { ComponentInstance, VNode } from "vue/types/index";
import type { ComponentOptions } from "vue/types/options";
import {
  ReactiveFlags,
  TrackOpTypes,
  TriggerOpTypes,
} from "../reactivity/operations";
import { h } from "./h";

enum ComponentInstanceAttrFlag {
  SLOTS = "$slots",
  ATTRS = "$attrs",
  PROPS = "$props",
  _PROPS = "_props",
  SCOPEDSLOTS = "$scopedSlots",
}

enum CallHooksFlag {
  INSTANCEOPTIONSVNODEUPDATE = "_parentVnode",
  SETUPRENDER = "setupRender",
}

enum VmOptionsItem {
  PROPSDATA = "propsData",
  PARENTVNODE = "_parentVnode",
}

export enum SetupFlag {
  SETUPCOMPONENTREF = "_setup",
  USERNATIVESETUP = "useNativeSetup",
}

enum PatchObjectBothCallbackArg2FlagType {
  SET = 1,
  ADD = 2,
  DELETE = 3,
}

export interface SetupContext {
  attrs: Record<string, any>;
  slots: Record<string, (state?: any) => VNode[]>;
  listeners: Record<string, Function | Function[]>;
  emit: (event: string, ...args: any[]) => any;
  expose: (exposed: Record<string, any>) => void;
}

interface PatchVNodeRefPrevRecordCachesItem {
  node: VNode;
  refFn: Function & { originRef?: any };
}

enum DefineInstanceOptionsProxyCallHooksNames {
  GET = "get",
  SET = "set",
}

interface DefineInstanceOptionsProxyCallHooksCacheContext {
  proxy: ComponentInstance["$options"];
  hooks: Record<
    DefineInstanceOptionsProxyCallHooksNames,
    Record<string, Function[]>
  >;
}

declare module "vue/types/vue" {
  interface Vue {
    setupContext?: SetupContext;
  }
}

const publicPropertiesMap = Vue.util.extend(Object.create(null), {
  $: (i: ComponentInstance) => i,
  //@ts-ignore
  $el: (i: ComponentInstance) => i.$el || i.$vnode?.elm || i._vnode?.elm,
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
  callback?: (key: string, flag?: number) => any
) {
  if (obj1 === obj2 || obj1 === null || (obj2 === null && obj1 == obj2)) {
    return;
  }
  obj1 ??= EMPTY_OBJ;
  obj2 ??= {};
  callback ??= (key) => key && obj1[key];
  const obj2Keys = [];
  for (const key in obj1) {
    if (key in obj2) {
      if (hasChanged(obj1[key], obj2[key])) {
        obj2[key] = callback(key, PatchObjectBothCallbackArg2FlagType.SET);
      }
    } else {
      obj2[key] = callback(key, PatchObjectBothCallbackArg2FlagType.ADD);
    }
    obj2Keys.push(key);
  }
  for (const key in obj2) {
    if (obj2Keys.indexOf(key) === -1) {
      callback(key, PatchObjectBothCallbackArg2FlagType.DELETE);
      delete obj2[key];
    }
  }
  return obj2;
}

const defineInstanceOptionsProxyCallHooksCaches = new WeakMap<
  ComponentInstance["$options"],
  DefineInstanceOptionsProxyCallHooksCacheContext
>();

const injectInstanceOptionsProxyCallHook = (
  options: ComponentInstance["$options"],
  type: DefineInstanceOptionsProxyCallHooksNames,
  key: string,
  fn: Function
) => {
  options = (options as any)[ReactiveFlags.RAW] || options;
  const o = defineInstanceOptionsProxyCallHooksCaches.get(options);
  if (o) {
    o.hooks[type][key] ??= [];
    o.hooks[type][key].push(fn);
  }
};

const callInstanceOptionsProxyCallHooks = (
  options: ComponentInstance["$options"],
  type: DefineInstanceOptionsProxyCallHooksNames,
  key: string,
  ...args: any[]
) => {
  options = (options as any)[ReactiveFlags.RAW] || options;
  const o = defineInstanceOptionsProxyCallHooksCaches.get(options);
  if (o && o.hooks[type][key]) {
    o.hooks[type][key].forEach((hook) => {
      if (isFunction(hook)) {
        hook(...args);
      } else {
        Vue.util.warn(
          `callInstanceOptionsProxyCallHooks: hook is not a function, key: ${key}, type: ${type}`
        );
      }
    });
  }
};

function defineInstanceOptionsProxy<T extends ComponentInstance["$options"]>(
  options: T
) {
  if (defineInstanceOptionsProxyCallHooksCaches.has(options)) {
    return defineInstanceOptionsProxyCallHooksCaches.get(options)!.proxy as T;
  }
  const o = {
    proxy: new Proxy(options, {
      get(target, key, receiver) {
        if (key === ReactiveFlags.RAW) {
          return options;
        }
        callInstanceOptionsProxyCallHooks(
          options,
          DefineInstanceOptionsProxyCallHooksNames.GET,
          key as string
        );
        return Reflect.get(target, key, receiver);
      },
      set(target, key, value, receiver) {
        Reflect.set(target, key, value, receiver);
        callInstanceOptionsProxyCallHooks(
          options,
          DefineInstanceOptionsProxyCallHooksNames.SET,
          key as string,
          ...arguments
        );
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
        callInstanceOptionsProxyCallHooks(
          options,
          DefineInstanceOptionsProxyCallHooksNames.SET,
          key as string
        );
        return Reflect.deleteProperty(target, key);
      },
    }),
    hooks: {
      [DefineInstanceOptionsProxyCallHooksNames.GET]: {},
      [DefineInstanceOptionsProxyCallHooksNames.SET]: {},
    },
  };

  defineInstanceOptionsProxyCallHooksCaches.set(options, o);

  return o.proxy;
}

function initSetup(this: ComponentInstance) {
  const $options = this.$options || {};
  if (SetupFlag.SETUPCOMPONENTREF in $options) {
    //@ts-ignore
    const scope = (this._vue2SetupScope = new EffectScope(true));
    //@ts-ignore
    this._setupState = {};
    //@ts-ignore
    this._isSetupComponent = true;
    scope.run(() => {
      const setup = $options._setup;
      if (isFunction(setup)) {
        //@ts-ignore
        this.$options = defineInstanceOptionsProxy($options);

        const setupResult = setup.call(
          { $createElement: h },
          defineInstanceProps(),
          getContext() as SetupContext
        );

        onUnmounted(() => {
          defineInstanceOptionsProxyCallHooksCaches.delete($options);
        });

        if (isFunction(setupResult)) {
          $options.render = (...args: any[]) => {
            const prevInstance = getCurrentInstance();
            setCurrentInstance(this);
            try {
              //@ts-ignore
              return setupResult.call(this, ...args);
            } finally {
              setCurrentInstance(prevInstance?.proxy);
            }
          };
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

const getInstanceRootVnode = (instance: ComponentInstance) =>
  (instance.$options as any)[VmOptionsItem.PARENTVNODE] as VNode;

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
    defineInstanceExpose(instance, exposed);
  };
  let attrsProxy: SetupContext["attrs"];
  let slotsProxy: SetupContext["slots"];
  return Object.freeze({
    get attrs() {
      return attrsProxy || (attrsProxy = defineInstanceAttrs(instance));
    },
    get slots() {
      return slotsProxy || (slotsProxy = defineInstanceSlots(instance));
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

function defineInstanceAttrs(vm: ComponentInstance): SetupContext["attrs"] {
  let attrs = vm[ComponentInstanceAttrFlag.ATTRS] || {};
  let flag = 1;
  if (!hasOwn(vm, ComponentInstanceAttrFlag.ATTRS)) {
    flag = 2;
    // dangerousness
    const p = () => {
      //@ts-ignore
      const _parentVNode = (getInstanceRootVnode(vm) || EMPTY_OBJ) as VNode;
      const data = _parentVNode.data || EMPTY_OBJ;
      attrs ??= data?.attrs || {};
      let l;
      patchObjectBoth((l = data?.attrs ?? null), attrs);
      if (l !== attrs) {
        trigger(vm, TriggerOpTypes.SET, ComponentInstanceAttrFlag.ATTRS);
      }
    };
    injectInstanceOptionsProxyCallHook(
      vm.$options,
      DefineInstanceOptionsProxyCallHooksNames.SET,
      CallHooksFlag.INSTANCEOPTIONSVNODEUPDATE,
      p
    );
    p();
    //@ts-ignore
    vm.$attrs = attrs;
  } else {
    watch(
      () => vm.$attrs,
      (value) => {
        patchObjectBoth(value, attrs);
        // trigger(vm, "set", ComponentInstanceAttrFlag.ATTRS);
      },
      {
        flush: "sync",
      }
    );
  }
  let set$;
  return new Proxy(
    attrs,
    Vue.util.extend(
      {
        get(target: any, key: any) {
          if (flag === 2) {
            track(vm, TrackOpTypes.GET, "$attrs");
          }
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
        : EMPTY_OBJ
    )
  );
}

//兼容vue 2.0.0-alpha.1 ~ 2.1.0版本问题
function defineInstanceSlots2(vm: ComponentInstance): SetupContext["slots"] {
  //@ts-ignore
  let slots = {};
  const slots2 = new Proxy(slots, {
    get(target, key, receiver) {
      track(vm, TrackOpTypes.GET, ComponentInstanceAttrFlag.SLOTS);
      const slotVnode = Reflect.get(target, key, receiver);
      if (slotVnode) {
        //@ts-ignore
        return () => slotVnode;
      }
      return void 0;
    },
  });

  let $slots = vm[ComponentInstanceAttrFlag.SLOTS];

  Object.defineProperty(vm, ComponentInstanceAttrFlag.SLOTS, {
    get: () => $slots,
    set(value) {
      $slots = value;
      if (value !== slots) {
        let flag = 0;
        patchObjectBoth(value, slots, (k) => {
          flag = 1;
          return value[k];
        });
        flag &&
          trigger(vm, TriggerOpTypes.SET, ComponentInstanceAttrFlag.SLOTS);
      }
    },
  });

  return slots2;
}

//兼容vue 2.1.0 ~ 2.2.0版本问题
function defineInstanceSlots3(vm: ComponentInstance): SetupContext["slots"] {
  //@ts-ignore
  let slots = getInstanceRootVnode(vm)?.data?.scopedSlots || {};
  const slots2 = new Proxy(slots, {
    get(target, key, receiver) {
      track(vm, TrackOpTypes.GET, ComponentInstanceAttrFlag.SLOTS);
      const slot = Reflect.get(target, key, receiver);
      if (slot) {
        //@ts-ignore
        return (props: Record<any, any>) => vm._t(key, void 0, props, void 0);
      }
      return void 0;
    },
  });

  const p = () => {
    const scopedSlots = getInstanceRootVnode(vm)?.data?.scopedSlots;
    if (scopedSlots !== slots) {
      let flag = 0;
      patchObjectBoth(scopedSlots as any, slots, (k) => {
        flag = 1;
        return scopedSlots && (scopedSlots as any)[k];
      });
      flag && trigger(vm, TriggerOpTypes.SET, ComponentInstanceAttrFlag.SLOTS);
    }
  };
  injectInstanceOptionsProxyCallHook(
    vm.$options,
    DefineInstanceOptionsProxyCallHooksNames.SET,
    CallHooksFlag.INSTANCEOPTIONSVNODEUPDATE,
    p
  );
  p();
  return slots2 as SetupContext["slots"];
}

function defineInstanceSlots(vm: ComponentInstance): SetupContext["slots"] {
  const slotsPropertyDescriptor = getOwnPropertyDescriptor(
    vm,
    ComponentInstanceAttrFlag.SLOTS
  ) as TypedPropertyDescriptor<Record<string, VNode[]>>;

  if (!slotsPropertyDescriptor) {
    const data = getInstanceRootVnode(vm)?.data;
    if (data && "scopedSlots" in data) {
      return defineInstanceSlots3(vm);
    } else {
      Vue.util.warn(
        `The current version(${
          (Vue as any).version
        }) of vue  'setupContext' does not support the use of 'slots'`
      );
      return defineInstanceSlots2(vm);
    }
  }

  //@ts-ignore
  let scopedSlots = getInstanceRootVnode(vm)?.data?.scopedSlots || {};
  const slots = new Proxy(scopedSlots, {
    get(target, key, receiver) {
      track(vm, TrackOpTypes.GET, ComponentInstanceAttrFlag.SLOTS);
      const fn = Reflect.get(target, key, receiver);
      if (fn) {
        //@ts-ignore
        return (props: Record<any, any>) => vm._t(key, void 0, props, void 0);
      }
      return void 0;
    },
  });

  const { value, get, set } = slotsPropertyDescriptor || {};

  let $slots = value || {};

  Object.defineProperty(vm, ComponentInstanceAttrFlag.SLOTS, {
    get: get || (() => $slots),
    set(value) {
      if (set) {
        set.call(this, value);
      } else {
        $slots = value;
      }

      //@ts-ignore
      let currentScopedSlots = getInstanceRootVnode(vm)?.data?.scopedSlots;
      if (currentScopedSlots !== scopedSlots) {
        scopedSlots = currentScopedSlots ?? {};
        patchObjectBoth(scopedSlots, slots);
      }
    },
  });

  return slots as SetupContext["slots"];
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

const patchVNodeRefPrevRecordCaches = new WeakMap<
  ComponentInstance,
  PatchVNodeRefPrevRecordCachesItem
>();

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
      let oo: PatchVNodeRefPrevRecordCachesItem;
      patchVNodeRefPrevRecordCaches.set(
        vm,
        (oo = {
          node: _parentVNode,
          // 兼容vue版本问题 通过proxy进行代理
          refFn: new Proxy(function () {}, {
            apply(_, __, [vnode]: [VNode]) {
              registerRef(_parentVNode, vnode === null);
            },
            get(fn, p, fn2) {
              switch (p) {
                //低版本的vue ref不支持函数式用法
                case "toString":
                  return () => oo.refFn.originRef;
              }
              return Reflect.get(fn, p, fn2);
            },
          }),
        })
      );
      const o = data.ref;
      data.ref = oo.refFn;
      data.ref.originRef = o;
    }
  }
}

function defineInstanceExpose(
  instance: ComponentInstance,
  exposeState?: Record<any, any>
) {
  exposeState ??= {};
  //@ts-ignore
  instance._isExpose = true;
  injectInstanceOptionsProxyCallHook(
    instance.$options,
    DefineInstanceOptionsProxyCallHooksNames.SET,
    CallHooksFlag.INSTANCEOPTIONSVNODEUPDATE,
    () => {
      //@ts-ignore
      if (instance._isExpose) {
        patchVNodeRef(instance);
      }
    }
  );

  onBeforeMount(() => {
    patchVNodeRef(instance);
  });

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
  //@ts-ignore
  if (!proxy._isSetupComponent) {
    Vue.util.warn(`useContext() The current instance is not a setup component`);
    return;
  }
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
        const rawProps = proxy.$props || props;
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

function defineInstanceProps(instance?: ComponentInstance) {
  instance ??= currentInstance as ComponentInstance;
  if (instance) {
    let propsData = reactive(instance.$options.propsData || {}),
      propsData2: any = propsData,
      props = shallowReadonly(propsData);

    injectInstanceOptionsProxyCallHook(
      instance.$options,
      DefineInstanceOptionsProxyCallHooksNames.SET,
      CallHooksFlag.INSTANCEOPTIONSVNODEUPDATE,
      () => {
        const currentComponentRootVnode = //@ts-ignore
          instance.$options._parentVnode as VNode;
        if (currentComponentRootVnode) {
          const componentOptions = currentComponentRootVnode.componentOptions;
          if (componentOptions) {
            if (componentOptions.propsData !== propsData2) {
              propsData2 = componentOptions.propsData;
              patchObjectBoth(propsData2, propsData);
            }
          }
        }
      }
    );

    return props;
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

function defineComponent(
  options: ComponentOptions<ComponentInstance> | Function
) {
  const currentInstance = getCurrentInstance();
  if (currentInstance) {
    const i = currentInstance.proxy;
    const options2 = isFunction(options) ? options() : options;
    if (!options2) return;
    mergeComponentOptions(
      toRaw(i.$options) as ComponentOptions<ComponentInstance>,
      options2,
      i
    );
  } else {
    Vue.util.warn(
      "defineComponent is called without current active component instance."
    );
  }
}

function normalizeInject(
  options: ComponentOptions<ComponentInstance>,
  instance?: ComponentInstance
) {
  const inject = options.inject;
  if (!inject) return;
  const normalized = (options.inject = {}) as any;
  if (isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = {
        from: inject[i],
      };
    }
  } else if (isObject2(inject)) {
    for (let key in inject) {
      const val = inject[key];
      normalized[key] = isObject2(val)
        ? Vue.util.extend(
            {
              from: key,
            },
            val
          )
        : {
            from: val,
          };
    }
  } else if (process.env.NODE_ENV !== "production") {
    Vue.util.warn(
      'Invalid value for option "inject": expected an Array or an Object, ' +
        "but got ".concat(toRawType(inject), "."),
      instance as any
    );
  }
}

function normalizeDirectives(options: ComponentOptions<ComponentInstance>) {
  const dirs = options.directives;
  if (dirs) {
    for (let key in dirs) {
      const def = dirs[key];
      if (isFunction(def)) {
        dirs[key] = {
          bind: def,
          update: def,
        };
      }
    }
  }
}

function mergeComponentOptions(
  componentOptions: ComponentOptions<ComponentInstance>,
  options: ComponentOptions<ComponentInstance>,
  instance?: ComponentInstance
) {
  // Vue.util.extend(
  //   componentOptions,
  //   Vue.util.mergeOptions(componentOptions, options, instance)
  // );
  // return;
  const optionMergeStrategies = (Vue.config as any).optionMergeStrategies;
  if (!optionMergeStrategies) {
    Vue.util.warn(
      `The current version(${
        (Vue as any).version
      }) of vue  'setup' does not support the use of 'defineComponent'`
    );
  }
  normalizeInject(options, instance);
  normalizeDirectives(options);
  for (let k in options) {
    if (k === "mixins") {
      const mixins = options[k];
      if (mixins)
        for (let mixin of mixins) {
          mergeComponentOptions(
            componentOptions,
            mixin as ComponentOptions<ComponentInstance>
          );
        }
      continue;
    }
    if (k in optionMergeStrategies) {
      const res = optionMergeStrategies[k](
        (componentOptions as any)[k],
        (options as any)[k],
        instance,
        k
      );
      if (res) {
        (componentOptions as any)[k] = res;
      }
    }
  }
}

export {
  initSetup,
  useSlots,
  useAttrs,
  getContext,
  useModel,
  useCssVars,
  defineComponent,
};
