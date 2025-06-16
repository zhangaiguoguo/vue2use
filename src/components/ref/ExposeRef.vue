<template>
  <div>
    <h1>Expose Ref Test</h1>
    <input type="text" v-model="msg" />
    <h1>{{ msg }}</h1>
  </div>
</template>

<script lang="jsx">
import {
  getContext,
  ref,
  onMounted,
  onUpdated,
  h,
  reactive,
  useAttrs,
  useSlots,
  effect,
  watchEffect,
  inject,
} from "@/vue2use/packages";
import { defineComponent } from "vue";

export default {
  props: {
    a: {},
  },
  setup(props, context) {
    const msg = ref("expose ref");
    getContext().expose({
      msg,
    });

    inject("a");

    onMounted(() => {
      console.log("mounted");
    });

    console.log(props);
    useAttrs();
    useSlots();

    watchEffect(() => {
      // console.log(context.attrs.num, "11111");
    });

    effect(
      () => {
        msg.value;
      },
      (v) => {
        v();
      }
    );

    onUpdated(() => {
      console.log("update");
    });

    const v = ref(1);

    return { msg };
  },
  data() {
    return {};
  },
};
</script>
