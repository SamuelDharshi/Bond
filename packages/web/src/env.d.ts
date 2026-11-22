/// <reference types="vite/client" />
declare module '@proof-txids' {
  const value: unknown;
  export default value;
}
declare module '@bond-source?raw' {
  const src: string;
  export default src;
}
interface ImportMetaEnv {
  readonly VITE_DEMO_MAINTAINER_WIF?: string;
  readonly VITE_DEMO_REPO?: string;
  readonly VITE_WIZ_RELAY_PRIMARY?: string;
  readonly VITE_WIZ_RELAY_FALLBACK?: string;
  readonly VITE_BLAZE_PRESENTATION_URL?: string;
  readonly VITE_BLAZE_SOURCE_URL?: string;
  readonly VITE_BLAZE_EMBER_ADDRESS?: string;
  readonly VITE_BLAZE_VIDEO_URL?: string;
}
