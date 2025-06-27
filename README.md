# vue2use 深度使用指南

## 介绍

[vue2use](https://github.com/zhangaiguoguo/vue2use) 是一款专为 [Vue](https://v2.cn.vuejs.org/) 2 生态设计的扩展插件，通过引入 Vue 3 Composition API 的核心特性（如 `setup` 语法糖和组件化 API 风格），使开发者能够在 Vue 2.0.0+ 版本中提前体验现代化开发模式，同时保持与现有项目的兼容性，助力大型应用的可维护性升级。

## 安装

```bash
npm install vue2use --save # 或 yarn add vue2use
```

## 核心功能详解

### 1. 响应式系统重构

- **实现原理**：基于 ES6 `Proxy` 代理，完整支持 Vue 3 的响应式行为：

  - **深度监听**：自动追踪对象/数组的增删改查（无需 `Vue.set`）
  - **副作用管理**：通过 `track`/`trigger` 机制实现依赖收集与精准更新
  - **类型覆盖**：支持 `ref`（基础类型）、`reactive`（对象/数组）、`readonly`（只读视图）

- **对比 Vue 3**：
  - 语法完全一致，但底层实现针对 Vue 2 事件系统优化
  - 额外提供 `toRaw`/`unref` 等工具函数强化类型操作

### 2. 侦听器体系升级

- **多模式监听**：

  - `watch`: 支持 `deep`/`immediate`/`once` 选项，精准监听数据变化
  - `watchEffect`: 自动追踪响应式依赖，简化副作用逻辑
  - `watchPostEffect`/`watchSyncEffect`: 扩展更新时机控制（如 SSR 场景）

- **调试支持**：
  - 通过 `getCurrentWatcher` 获取当前侦听器实例
  - `onTrack`/`onTrigger` 钩子实现依赖追踪日志

### 3. 组合式 API 集成

- **生命周期映射**：

  - 实现 Vue 3 的组合式生命周期（`onMounted`/`onUpdated`/`onUnmounted`）
  - 与 Vue 2 选项式 API 混用时，通过 `setup` 函数自动合并逻辑

- **上下文管理**：
  - `provide/inject` 实现跨组件状态共享
  - `useAttrs`/`useSlots` 替代 `$attrs`/`$slots`，支持 TS 类型推断

### 4. 高级特性支持

- **作用域控制**：

  - `EffectScope` 实现逻辑分组与批量销毁（如异步操作隔离）
  - `onScopeDispose` 注册作用域卸载回调

- **自定义 Ref**：
  - 通过 `customRef` 实现细粒度控制（如防抖输入、异步验证）

## 使用示例

### 响应式系统

#### 基础响应式引用

```typescript
import { ref, reactive, readonly } from "vue2use";

// 基本类型响应式
const msg = ref("Hello World");

// 对象响应式
const object = reactive({
  msg: "vue2use",
  arr: [{ a: 1 }],
});

// 只读响应式
const readonlyObject = readonly({
  a: 1,
});
```

#### 集合类型响应式

```typescript
const set = reactive(new Set());
const map = reactive(new Map());
```

#### 计算属性

```typescript
import { computed } from "vue2use";

const msgComputed = computed(() => object.msg + toValue(msg));
```

#### 侦听器

```typescript
import {
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  getCurrentWatcher,
  onWatcherCleanup,
  Watcher,
} from "vue2use";

// 基础 watch
watch(msgComputed, (v, ov) => {
  console.log(v, ov);
});

// 带选项的 watch
const stop = watch(
  msgComputed,
  (v, ov) => {
    console.log(v, ov);
  },
  {
    deep: true,
    immediate: true,
    once: true,
  }
);

// 效果侦听器
watchEffect(
  () => {
    console.log(set.size + map.size);
    console.log(getCurrentWatcher());
    onWatcherCleanup(() => {
      console.log("cleanup");
    });
  },
  {
    onTrack(event) {
      console.log(event, "onTrack");
    },
    onTrigger(event) {
      console.log(event, "onTrigger");
    },
  }
);

// 后置效果侦听器
watchPostEffect(() => {
  console.log(msg.value, "watchPostEffect");
});

// 同步效果侦听器
watchSyncEffect(() => {
  console.log(msg.value, "watchSyncEffect");
});

// vue 内置Watcher侦听器类
const watcher = new Watcher();
```

#### 自定义 Ref

```typescript
import { customRef } from "vue2use";

const customRefNum = customRef<number>((track, trigger) => {
  let num = 1;
  return {
    get() {
      track();
      return num;
    },
    set(v) {
      num = v;
      if (num % 2) {
        trigger(v, num);
      }
    },
  };
});
```

### 组件开发示例

#### 父组件

```typescript
import { useTemplateRef } from "vue2use";
const parent = {
  props: ["a"],
  emits: ["update:a"],
  setup(props, { expose, emit }) {
    const msg = ref("hello setup");
    const obj = reactive({ a: 1 });
    //useTemplateRef 获取子组件expose的内容
    const childExpose = useTemplateRef("childRef");

    expose({
      msg,
      obj,
      a: computed(() => props.a + msg.value),
    });

    onMounted(() => {
      console.log("onMounted");
    });

    return () =>
      h("main", null, [
        h("footer", {
          scopedSlots: {
            footer({ a }) {
              return `${msg.value} + ${props.a} + slot -> a${a}`;
            },
          },
          ref: "childRef",
        }),
      ]);
  },
};
```

#### 子组件

```typescript
const child = {
  setup() {
    const msg = inject("msg");

    defineComponent({
      created() {},
      inject: ["msg2"],
    });

    return () => context.slots.footer({ a: msg.value });
  },
};
```

## 与 Vue 3 差异对照表

| 特性       | Vue 3 行为      | vue2use 实现        | 注意事项                         |
| ---------- | --------------- | ------------------- | -------------------------------- |
| 响应式系统 | 基于 Proxy      | 完全复现            | 需兼容 Vue 2 事件机制            |
| 生命周期   | 组合式 API 优先 | 可与选项式 API 混用 | 需手动迁移 beforeCreate          |
| TypeScript | 原生支持        | 原生支持            | 复杂类型建议使用 defineComponent |

## 最佳实践建议

1. **渐进式迁移**：

   - 新组件优先使用 `setup` 函数 + 组合式 API
   - 旧组件逐步重构，通过 `expose` 暴露状态给子组件

2. **性能优化**：

   ```typescript
   // 避免无效计算
   const optimized = computed(() => {
     if (!isMounted.value) return;
     return heavyComputation();
   });

   // 使用 shallowRef 优化深层对象
   const shallowState = shallowRef({ a: 1 });
   ```

3. **调试技巧**：
   ```typescript
   watchEffect((onCleanup) => {
     onCleanup(() => {
       console.log("Cleanup executed");
     });
   });
   ```
