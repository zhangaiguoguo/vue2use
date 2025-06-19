import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

/** @type {import('rollup').RollupOptions} */

function resolveReplace() {
  const replacements = {
    "process.env.NODE_ENV": '"production"',
  };

  if (Object.keys(replacements).length) {
    return [
      replace({
        values: replacements,
        preventAssignment: true,
        "process.env.NODE_ENV": JSON.stringify("production"),
      }),
    ];
  } else {
    return [];
  }
}

export default [
  {
    input: "./packages/index.ts",
    output: [
      {
        file: "./packages/dist/vue2use.cjs.js",
        format: "cjs",
        exports: "named",
      },
      {
        file: "./packages/dist/vue2use.esm.js",
        format: "es",
        exports: "named",
      },
      {
        file: "./packages/dist/vue2use.js",
        format: "iife",
        name: "Vue2use",
        exports: "named",
      },
      {
        file: "./packages/dist/vue2use.min.js",
        format: "iife",
        name: "Vue2use",
        exports: "named",
        plugins: [terser()],
      },
    ],
    define: {},
    external: ["vue"],
    plugins: [
      typescript({
        outputToFilesystem: true,
      }),
      ...resolveReplace(),
      resolve({
        exports: true,
        extensions: [".js", ".json", ".node"],
        mainFields: ["module", "main"],
      }),
      commonjs(),
    ],
  },
  {
    input: "./packages/index.ts",
    output: {
      file: "./packages/types/index.d.ts",
      format: "es",
    },
    plugins: [
      dts({
        compilerOptions: {
          skipLibCheck: true,
        },
      }),
    ],
  },
];
