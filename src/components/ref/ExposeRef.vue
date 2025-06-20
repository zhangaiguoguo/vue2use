<template>
  <div>
    <h1>Expose Ref Test</h1>
    <input type="text" v-model="msg" />
    <h1>{{ msg }}{{ a | pluralize }}</h1>
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
  defineComponent,
} from "@/vue2use";

export default {
  props: {
    a: {},
  },
  mixins: [
    {
      created() {},
    },
  ],
  setup(props, context) {
    defineComponent({
      mounted() {
        console.log("mounted defineComponent");
      },
      mixins: [
        {
          filters: {
            pluralize: function (n) {
              return n === 1 ? "item" : "items";
            },
          },
        }
      ],
    });
    onMounted(() => {
      console.log("mounted2");
    });
    const msg = ref("expose ref1");
    getContext()?.expose?.({
      msg,
    });

    inject("a");

    onMounted(() => {
      console.log("mounted");
    });

    useAttrs();
    useSlots();

    watchEffect(() => {
      // console.log(context.attrs.num, "11111");
    });

    watchEffect(() => {
      console.log(props.a, "props");
    });
    console.log(props);

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
