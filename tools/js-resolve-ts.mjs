import fs from "node:fs";
import path from "node:path";

/**
 * esbuild plugin that handles Bun-style `require('./file.js')` in a TS codebase.
 *
 * Bun allows importing .ts files as .js. esbuild doesn't know about this.
 * This plugin:
 * 1. Resolves .js → .ts/.tsx when the .js doesn't exist but .ts does
 * 2. Marks .js requires as external when neither .js nor .ts exist on disk
 *    (these are feature-gated lazy modules that don't exist in source)
 */
export function jsResolveTsPlugin() {
  return {
    name: "js-resolve-ts",
    setup(build) {
      build.onResolve({ filter: /\.js$/ }, (args) => {
        // Only handle relative imports
        if (!args.path.startsWith(".")) return;

        const resolvedDir = path.resolve(
          args.resolveDir || path.dirname(args.importer || ""),
        );
        const jsPath = path.resolve(resolvedDir, args.path);

        // If .js file actually exists, let esbuild handle it normally
        if (fs.existsSync(jsPath)) return;

        // Try .ts and .tsx alternatives
        const tsPath = jsPath.replace(/\.js$/, ".ts");
        const tsxPath = jsPath.replace(/\.js$/, ".tsx");

        if (fs.existsSync(tsPath)) {
          return { path: tsPath };
        }
        if (fs.existsSync(tsxPath)) {
          return { path: tsxPath };
        }

        // Neither .js nor .ts exist — mark as external
        // (feature-gated lazy module, compiled binary artifact, etc.)
        return { path: args.path, external: true };
      });
    },
  };
}
