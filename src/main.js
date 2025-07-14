import Vue from "vue";
import App from "./App.vue";
import Vue2use, { ref, computed, h } from "@/vue2use";

Vue.config.productionTip = false;

Vue.use(Vue2use);

const app = new Vue({
  // eslint-disable-next-line no-dupe-keys
  render(h) {
    return h("div", [
      h(
        "button",
        {
          on: {
            click: () => {
              this.a++;
            },
          },
        },
        "点击 -" + (this.a % 2 ? this.a : this.b)
      ),
    ]);
  },
  setup() {
    const a = ref(1);
    const b = computed(() => {
      console.log("computed");
      return a.value;
    });

    return () => h(App);
  },
});

app.$mount("#app");
