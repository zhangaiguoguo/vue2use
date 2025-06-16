const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: false,// 全局变量配置
  chainWebpack: (config) => {
    // 添加后缀拓展引入支持
    config.resolve.extensions.add('.ts').add('.tsx');
    config.module
        .rule('ts')
        .test(/\.(ts|tsx)$/)
        .use('ts-loader')
        .loader('ts-loader')
        .options({
          // 配置能够识别vue中的ts
          appendTsSuffixTo: [/\.vue$/]
        })
        .end();
  },

})
