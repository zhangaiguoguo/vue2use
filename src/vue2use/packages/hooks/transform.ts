import Vue from "vue";
import { initSetup, type SetupContext } from "./setup";
import {
  callHooks,
  clearVmCallHooks,
  injectVmCallHook,
} from "./vmCallHooksCaches";
import { currentInstance, setCurrentInstance } from "./currentInstance";
import type { CreateElement } from "vue/types/vue";
import type { ComponentInstance } from "vue/types/index";
import type { PropsDefinition } from "vue/types/options";
import type { VNode } from "vue/types/vnode";
import type { ComponentOptionsMixin } from "vue/types/v3-component-options";

class Vue2Hooks {
  constructor() {}

  static vue2OriginPrototype: typeof Vue.prototype =
    null as unknown as typeof Vue.prototype;
  static install(vue: typeof Vue) {
    const VuePrototype = vue.prototype;
    //@ts-ignore
    vue.prototype = vue2Prototype;
    Reflect.setPrototypeOf(vue2Prototype, VuePrototype);
    Vue2Hooks.vue2OriginPrototype = VuePrototype;
  }
}

type DefaultData<V> = object | ((this: V) => object);
type DefaultProps = Record<string, any>;
type DefaultMethods<V> = { [key: string]: (this: V, ...args: any[]) => any };
type DefaultComputed = { [key: string]: any };

declare global {
  namespace Vue {
    interface ComponentOptions<
      V extends typeof Vue,
      Data = DefaultData<V>,
      Methods = DefaultMethods<V>,
      Computed = DefaultComputed,
      PropsDef = PropsDefinition<DefaultProps>,
      Props = DefaultProps,
      RawBindings = {},
      Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
      Extends extends ComponentOptionsMixin = ComponentOptionsMixin
    > {
      setup?: (
        this: void,
        props: Props,
        ctx: SetupContext
      ) =>
        | Promise<RawBindings>
        | RawBindings
        | ((h: CreateElement) => VNode)
        | void;
      _setup?: (
        this: void,
        props: Props,
        ctx: SetupContext
      ) =>
        | Promise<RawBindings>
        | RawBindings
        | ((h: CreateElement) => VNode)
        | void;
    }
  }
}

const vue2Prototype = {
  _init(this: ComponentInstance, options: vuejs.ComponentOption) {
    let prevInstance;
    prevInstance = currentInstance;
    try {
      setCurrentInstance(this);
      if (options) {
        initVue2Setup(this);
      }
      return Vue2Hooks.vue2OriginPrototype._init.call(this, options);
    } finally {
      setCurrentInstance(prevInstance);
    }
  },
  _update(this: ComponentInstance, vnode: VNode, hydrating?: boolean) {
    let prevInstance;
    prevInstance = currentInstance;
    try {
      setCurrentInstance(this);
      callHooks(this, "update", ...arguments);
      //@ts-ignore
      return Vue2Hooks.vue2OriginPrototype._update.call(this, vnode, hydrating);
    } finally {
      setCurrentInstance(prevInstance);
    }
  },
};

Vue.mixin({
  created(this: ComponentInstance) {
    callHooks(this, "created");
    clearVmCallHooks(this, "created");
  },
  beforeCreate(this: ComponentInstance) {
    callHooks(this, "beforeCreate");
    clearVmCallHooks(this, "beforeCreate");
  },
});

function initVue2Setup(vm: ComponentInstance) {
  injectVmCallHook(vm, "beforeCreate", () => {
    if ("setup" in vm.$options) {
      //@ts-ignore
      vm.$options._setup = vm.$options.setup;
      //@ts-ignore
      vm.$options.setup = null;
    }
  });
  injectVmCallHook(vm, "created", initSetup);
}

export default Vue2Hooks;
