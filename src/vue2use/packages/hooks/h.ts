import Vue from "vue";
import type { Vue as VueInstance } from "vue/types/vue";
import vm from "../vm";
import { currentInstance } from "./currentInstance";
import type { VNode, VNodeChildren, VNodeData } from "vue/types/vnode";
import { AsyncComponent, Component } from "vue/types/umd";

export function h(
  tag?:
    | string
    | Component<any, any, any, any>
    | AsyncComponent<any, any, any, any>
    | (() => Component),
  children?: VNodeChildren
): VNode;

export function h(
  tag?:
    | string
    | Component<any, any, any, any>
    | AsyncComponent<any, any, any, any>
    | (() => Component),
  data?: VNodeData,
  children?: VNodeChildren
): VNode;

export function h(type: any, props?: any, children?: any) {
  if (!currentInstance) {
    Vue.util.warn(
      "globally imported h() can only be invoked when there is an active " +
        "component instance, e.g. synchronously in a component's render or setup function."
    );
  }
  //@ts-ignore
  const vnode = vm.$createElement(type, props, children, 2, true);
  vnode.context = currentInstance as VueInstance;

  return vnode;
}