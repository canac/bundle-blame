import { assertEquals } from "@std/assert";
import { getViteRoutes, type ViteManifest } from "./vite_builder.ts";

const manifest: ViteManifest = {
  "node_modules/.pnpm/framework@1.0.0_abc/node_modules/framework/client.tsx": {
    file: "assets/index-a.js",
    isEntry: true,
    imports: ["_react.js"],
    dynamicImports: ["src/routes/login.tsx?tsr-split=component"],
  },
  "src/routes/login.tsx?tsr-split=component": {
    file: "assets/login-b.js",
    isDynamicEntry: true,
    imports: ["_Button.js", "_react.js"],
    css: ["assets/login-b.css"],
  },
  "_Button.js": {
    file: "assets/Button-c.js",
    imports: ["_react.js"],
  },
  "_react.js": {
    file: "assets/react-d.js",
  },
  "src/global.css": {
    file: "assets/global-e.css",
    src: "src/global.css",
  },
};

Deno.test("getViteRoutes adds the entry's files to each lazy route", () => {
  assertEquals(getViteRoutes(manifest), {
    "src/routes/login.tsx?tsr-split=component": [
      "assets/index-a.js",
      "assets/react-d.js",
      "assets/login-b.js",
      "assets/Button-c.js",
    ],
  });
});

Deno.test("getViteRoutes adds the entry's files to nested lazy routes", () => {
  assertEquals(
    getViteRoutes({
      "main.ts": { file: "main.js", isEntry: true, imports: ["_a.js"] },
      "_a.js": { file: "a.js", dynamicImports: ["layout.ts?tsr-split=component"] },
      "layout.ts?tsr-split=component": {
        file: "layout.js",
        isDynamicEntry: true,
        dynamicImports: ["page.ts?tsr-split=component"],
      },
      "page.ts?tsr-split=component": { file: "page.js", isDynamicEntry: true },
    }),
    {
      "layout.ts?tsr-split=component": ["main.js", "a.js", "layout.js"],
      "page.ts?tsr-split=component": ["main.js", "a.js", "page.js"],
    },
  );
});

Deno.test("getViteRoutes excludes the entry's files from lazy imports that are not routes", () => {
  assertEquals(
    getViteRoutes({
      "main.ts": {
        file: "main.js",
        isEntry: true,
        imports: ["_react.js"],
        dynamicImports: ["page.ts?tsr-split=component", "notifications.ts"],
      },
      "_react.js": { file: "react.js" },
      "page.ts?tsr-split=component": {
        file: "page.js",
        isDynamicEntry: true,
        dynamicImports: ["Modal.tsx"],
      },
      "notifications.ts": { file: "notifications.js", isDynamicEntry: true },
      "Modal.tsx": { file: "Modal.js", isDynamicEntry: true, imports: ["_react.js", "_dialog.js"] },
      "_dialog.js": { file: "dialog.js" },
    }),
    {
      "page.ts?tsr-split=component": ["main.js", "react.js", "page.js"],
      "notifications.ts": ["notifications.js"],
      "Modal.tsx": ["Modal.js", "dialog.js"],
    },
  );
});

Deno.test("getViteRoutes keeps an entry without lazy routes as its own route", () => {
  assertEquals(
    getViteRoutes({
      "main.ts": { file: "main.js", isEntry: true, imports: ["_a.js"] },
      "_a.js": { file: "a.js", imports: ["_b.js"] },
      "_b.js": { file: "b.js", imports: ["_a.js"] },
    }),
    { "main.ts": ["main.js", "a.js", "b.js"] },
  );
});

Deno.test("getViteRoutes keeps an entry without lazy routes alongside its lazy imports", () => {
  assertEquals(
    getViteRoutes({
      "main.ts": { file: "main.js", isEntry: true, dynamicImports: ["Modal.tsx"] },
      "Modal.tsx": { file: "Modal.js", isDynamicEntry: true },
    }),
    { "main.ts": ["main.js"], "Modal.tsx": ["Modal.js"] },
  );
});
