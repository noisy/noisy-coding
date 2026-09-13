/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare const __APP_VERSION__: string;
// The Storybook website story pulls website/src into this TypeScript
// program, and its analytics module reads a build-time define that only
// website/vite.config.ts provides. Declare it here so a clean checkout
// type-checks (the analytics merge passed locally only via the incremental
// cache; the macOS release runner caught it on 3.0.0-alpha.2).
declare const __POSTHOG_CONFIG__: { projectToken: string; host: string };
