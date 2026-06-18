// Bundles the extension host (src/extension.ts) into a single dist/extension.js
// the VS Code runtime loads on activation. Bundling beats tsc's per-file CJS
// output: faster activation (one module, not ~24) and a smaller .vsix.
//
// `vscode` is provided by the host and must stay external; Node built-ins are
// resolved natively at runtime. Pass --watch to rebuild on change.
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  // Match the Node bundled in supported VS Code (Electron) builds.
  target: ['node18'],
  outfile: 'dist/extension.js',
  external: ['vscode'],
  minify: !watch,
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[build-extension] watching…');
} else {
  await esbuild.build(options);
  console.log('[build-extension] built dist/extension.js');
}
