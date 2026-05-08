import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";
import { bunBundleFeatureTransformPlugin } from "./tools/bun-bundle-feature-transform.mjs";
import { jsResolveTsPlugin } from "./tools/js-resolve-ts.mjs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const buildVersion = process.env.NEKOFREE_NODE_BUILD_VERSION ?? `${pkg.version}-node-compat`;
const buildTime = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : "1970-01-01T00:00:00.000Z";

// Default CLI feature set (matches scripts/build.ts defaultFeatures)
const defaultFeatures = ["EXTRACT_MEMORIES", "VERIFICATION_AGENT"];

// Allow override via env: NEKOFREE_FEATURES=FLAG1,FLAG2
const envFeatures = (process.env.NEKOFREE_FEATURES ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const features = envFeatures.length > 0 ? envFeatures : defaultFeatures;

export default defineConfig({
  entry: ["src/entrypoints/cli.tsx"],
  outDir: "dist-node",
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  noExternal: ["jsonc-parser"],

  esbuildOptions(options) {
    options.logOverride = {
      ...options.logOverride,
      "suspicious-logical-operator": "silent",
    };
  },

  banner: {
    js: `#!/usr/bin/env node
import { createRequire as __nekofreeCreateRequire } from "node:module";
const require = __nekofreeCreateRequire(import.meta.url);`,
  },
  define: {
    "process.env.USER_TYPE": JSON.stringify("external"),
    "MACRO.VERSION": JSON.stringify(buildVersion),
    "MACRO.BUILD_TIME": JSON.stringify(buildTime),
    "MACRO.PACKAGE_URL": JSON.stringify("nekofree"),
    "MACRO.NATIVE_PACKAGE_URL": "undefined",
    "MACRO.FEEDBACK_CHANNEL": JSON.stringify("github"),
    "MACRO.ISSUES_EXPLAINER": JSON.stringify(
      "This Node-compatible build does not include Anthropic internal issue routing."
    ),
    "MACRO.VERSION_CHANGELOG": JSON.stringify("https://github.com/howdeploy/nekofree"),
  },
  esbuildPlugins: [jsResolveTsPlugin(), bunBundleFeatureTransformPlugin({ features })],
});
