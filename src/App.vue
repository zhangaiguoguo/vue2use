<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.8s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter,
.slide-fade-leave-to

  /* .slide-fade-leave-active below version 2.1.8 */ {
  transform: translateX(10px);
  opacity: 0;
}

.flex {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>

<template>
  <div id="app">
    <transition-group name="slide-fade" appear>
      <div v-for="(item, index) in arr.get()" :key="index">
        <h1>{{ item }}</h1>
        <button @click="arr.set(index, item + 1)">点击</button>
        <Component v-if="item % 2" :is="ExposeRef" ref="exposeRefs3" />
        <ExposeRef ref="exposeRefs4" num="1" :obj="{}">
          <template #a>
            <span>1</span>
          </template>
        </ExposeRef>
        <hr />
      </div>
    </transition-group>
    <div>
      <br />
      <button @click="arr.get().push(arr.get().length + 1)">arr 新增</button>
      <button @click="arr.get().pop()">arr 后删</button>
    </div>
    <ExposeRef
      ref="exposeRefs2"
      :a="arr.get('length')"
      :num="numComputed"
      :numComputed="numComputed"
    />
    <Component :is="ExposeRef" ref="exposeRefs" />
    <br />
    <button @click="numComputed++">numComputed++</button>
    <button @click="num++">num++</button>
    <br />
    <div>map - size -> [{{ map.size }}]</div>
    <br />
    <div v-for="[k, v] of map.entries()" :key="k">
      {{ v }}
    </div>
    <br />
    <div>set - size -> [{{ set.size }}]</div>
  </div>
</template>

<script lang="jsx">
import {
  computed,
  Dep,
  effect,
  getCurrentInstance,
  h,
  inject,
  observer,
  ObserverImpl,
  provide,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  toRaw,
  toValue,
  Watcher,
} from "@/vue2use/packages";
import ExposeRef from "@/components/ref/ExposeRef.vue";

export default {
  name: "App",
  components: { ExposeRef },
  data() {
    return {};
  },
  created() {
    window.vm = this;
  },
  setup(props, context) {
    const arr = observer([]);
    const exposeRefs = ref(null);
    const num = ref(0);
    const numComputed = computed({
      get: () => {
        return toValue(num);
      },
      set: (v) => {
        num.value = v;
      },
    });
    const obj = reactive({
      a: 1,
      b: { a: 1, b: new Map([["a", { a: 1 }]]), c: new Set([1, 2, 3]) },
    });
    const map = computed(() => obj.b.b);
    const set = computed(() => obj.b.c);
    const readonlyObj = readonly({ a: 1, b: { a: 1 } });
    const shallowReactiveObj = shallowReactive(toRaw(readonlyObj));
    const shallowReadonlyObj = shallowReadonly(toRaw(shallowReactiveObj));
    const shallowRefObj = shallowRef(toRaw(shallowReadonlyObj));
    new Dep();

    new Watcher(
      getCurrentInstance().proxy,
      () => 1,
      () => void 0
    );

    inject(
      "a",
      function () {
        return 1;
      },
      true
    ); // 1

    provide("a", ref(1));

    // console.log(toRaw(obj));
    return {
      arr,
      exposeRefs,
      ExposeRef,
      numComputed,
      num,
      obj,
      map,
      set,
      readonlyObj,
      shallowReactiveObj,
      shallowReadonlyObj,
      shallowRefObj,
    };
  },
  watch: {},
  computed: {},
  methods: {},
};
</script>
