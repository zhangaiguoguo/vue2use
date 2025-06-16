module.exports = {
    root: true,
    env: {
        node: true
    },
    extends: ['plugin:vue/essential', 'eslint:recommended', 'plugin:prettier/recommended', 'plugin:@typescript-eslint/recommended'],
    // 使用vue-eslint-parser避免报错 ‘>’
    parser: 'vue-eslint-parser',
    parserOptions: {
        parser: {
            // 根据不同使用不同的编译
            js: '@babel/eslint-parser',
            ts: '@typescript-eslint/parser',
            vue: '@typescript-eslint/parser',
            ['<template>']: "@typescript-eslint/parser",
        }
        // plugins: ['@typescript-eslint']
        // ecmaFeatures:{
        //     jsx:true
        // }
    },
    rules: {
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        semi: [2, 'always']
    }
};
