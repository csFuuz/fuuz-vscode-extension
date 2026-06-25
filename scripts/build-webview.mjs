// Bundles the React webviews (ERD + config panel) into media/<name>/<name>.js
// as self-contained IIFE + CSS files the webviews load offline. Run via
// `npm run build:webview` (also invoked by `npm run compile`).
//
// Pass --watch to rebuild on change during development.
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: {
    erd: 'src/webview/erd/index.tsx',
    config: 'src/webview/config/index.tsx',
    report: 'src/webview/report/index.tsx',
    qaresult: 'src/webview/qaresult/index.tsx',
  },
  bundle: true,
  format: 'iife',
  // → media/erd/erd.{js,css} and media/config/config.{js,css}
  outdir: 'media',
  entryNames: '[name]/[name]',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  jsx: 'automatic',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  loader: { '.css': 'css' },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[build-webview] watching…');
} else {
  await esbuild.build(options);
  console.log('[build-webview] built media/erd + media/config');
}
