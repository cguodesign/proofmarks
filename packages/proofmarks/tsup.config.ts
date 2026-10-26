import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    helpers: "src/helpers.ts",
    react: "src/react.tsx",
    notations: "src/notations.ts",
    "notations/jis": "src/notations/jis.ts",
    "notations/gb": "src/notations/gb.ts",
    "notations/cns3927": "src/notations/cns3927.ts",
    "notations/ks": "src/notations/ks.ts",
    "notations/en-us": "src/notations/en-us.ts",
  },
  format: ["esm"],
  target: "es2022",
  platform: "browser",
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["react", "react/jsx-runtime"],
  noExternal: [/^@proofmarks\//],
});
