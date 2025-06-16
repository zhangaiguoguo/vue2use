import { NOOP } from "../shared";
import Vue from "vue";
import type { ComponentInstance } from "vue/types/index";

const vmOptions = {
  computed: {
    watcher: NOOP,
  },
};

//@ts-ignore
const vm: ComponentInstance = new Vue(vmOptions);

//@ts-ignore
vm._isMounted = true;

export default vm;
