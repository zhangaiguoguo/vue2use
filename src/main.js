import Vue, { ref } from "vue";
import App from "./App.vue";
import Vue2use from "@/vue2use";

Vue.config.productionTip = false;

Vue.use(Vue2use);

const app = new Vue({
  // eslint-disable-next-line no-dupe-keys
  render: (h) => h(App),
});

app.$mount("#app");
