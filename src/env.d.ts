/** package.json's version, put in by Vite at build time (vite.config.ts, define). */
declare const __APP_VERSION__: string;
/** The measuring build (TAHA_PERF=1): src/perf.ts runs. False in every normal build. */
declare const __PERF__: boolean;
/** The diagnostics build (TAHA_DIAG=1): src/diag.ts records the video display's events. False in every normal build. */
declare const __DIAG__: boolean;
