/// <reference types="vite/client" />
declare const __POSTHOG_CONFIG__: { projectToken: string; host: string };

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module "*.png" {
  const src: string;
  export default src;
}
