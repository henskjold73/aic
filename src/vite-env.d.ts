/// <reference types="vite/client" />

/** Short git SHA of the build, injected by vite `define`. */
declare const __BUILD_HASH__: string;

/** ISO-8601 timestamp of the build, injected by vite `define`. */
declare const __BUILD_TIME__: string;

/** Version of the sync script this frontend expects, injected by vite `define`. */
declare const __CURRENT_SCRIPT_VERSION__: string;
