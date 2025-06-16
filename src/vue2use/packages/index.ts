export * from "./reactivity";
export * from "./hooks/nextTick";
export * from "./hooks/lifeCycle";
export { provide, inject } from "./hooks/apiInject";
export { h } from "./hooks/h";
export { getCurrentInstance } from "./hooks/currentInstance";
export { effectScope, effect } from "./hooks/effect";

export { getContext, useAttrs, useSlots, useModel } from "./hooks/setup";

import Vue2Hooks from "./hooks/transform"

export default Vue2Hooks;
