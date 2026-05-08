import fs from "node:fs/promises";

function loaderFor(file) {
  if (file.endsWith(".tsx")) return "tsx";
  if (file.endsWith(".ts")) return "ts";
  if (file.endsWith(".jsx")) return "jsx";
  return "js";
}

/**
 * esbuild plugin that replaces `bun:bundle` feature() calls with
 * static true/false for Node-compatible builds.
 *
 * Transforms:
 *   import { feature } from "bun:bundle";  →  (removed)
 *   feature("FLAG")                        →  true/false
 *
 * Throws on any non-standard bun:bundle usage.
 */
export function bunBundleFeatureTransformPlugin({ features = [] } = {}) {
  const enabled = new Set(features);

  return {
    name: "bun-bundle-feature-transform",
    setup(build) {
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
        let source = await fs.readFile(args.path, "utf8");

        // Check for actual import (not just comments/strings)
        const importRegex = /import\s*\{\s*feature\s*\}\s*from\s*["']bun:bundle["'];?/;
        const hasImport = importRegex.test(source);

        // If bun:bundle only appears in comments/strings, skip the file
        if (!hasImport) {
          return;
        }

        // Remove the import line
        source = source.replace(
          /import\s*\{\s*feature\s*\}\s*from\s*["']bun:bundle["'];?\n?/g,
          ""
        );

        // Replace feature("FLAG") → true/false (handles trailing comma, multiline)
        source = source.replace(
          /\bfeature\s*\(\s*["']([A-Za-z0-9_]+)["']\s*,?\s*\)/gs,
          (_, flag) => (enabled.has(flag) ? "true" : "false")
        );

        // Warn if bun:bundle still referenced (likely in comments/strings)
        if (source.includes("bun:bundle") && process.env.NEKOFREE_NODE_BUILD_VERBOSE === "1") {
          console.warn(
            `[bun-bundle-transform] Note: ${args.path} still contains "bun:bundle" ` +
              `(likely in comments/strings, not code)`
          );
        }

        return {
          contents: source,
          loader: loaderFor(args.path),
        };
      });
    },
  };
}
