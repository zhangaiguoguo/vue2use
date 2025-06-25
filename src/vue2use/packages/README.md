# Vue2use 发行文件选择指南
#### 一、直接通过 \<script> 标签在浏览器中使用

 文件：**`vue2use.global.js（开发版） / vue2use.global.prod.js（生产版）`**

 特点：

    以 IIFE（立即调用函数表达式）形式提供，通过全局变量 Vue 暴露接口。
    生产版已预压缩，推荐在生产环境中使用。
    使用场景：
    快速原型开发或小型项目，无需构建步骤。

#### 二、使用原生 ES 模块`（\<script type="module">）`

 文件：**`vue2use.esm.js（开发版） / vue.esm.prod.js（生产版）`**

 特点：

    ES 模块格式，支持浏览器原生导入。

  使用场景：
  
    在浏览器中直接使用 ES 模块。
#### 三、服务端渲染（SSR）

 CommonJS 格式

  文件：**`vue2use.cjs.js（开发版） / vue2use.cjs.prod.js（生产版）`**

  特点：

    CommonJS 格式，适用于 Node.js 环境。
    自动根据 process.env.NODE_ENV 选择开发版或生产版。
  使用场景：

    在 Node.js 中进行服务端渲染。
    配合构建工具（如 webpack）使用，设置 target: 'node' 并正确外部化 Vue 依赖。
# 总结：

    直接浏览器使用：选择 `vue2use.global.js` 原生 ES 模块：选择 `vue2use.esm.js` 服务端渲染：选择 `vue2use.cjs.js`。


生产环境中，请务必使用预压缩的生产版文件（以 .prod.js 结尾），以获得更好的性能和更小的文件体积。