import vm from "../vm";

const nextTick: typeof vm.$nextTick = vm.$nextTick;

export { nextTick };
