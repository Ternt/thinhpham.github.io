import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './src/index.html',
  },
  source: {
    entry: {
      index: './src/index.js',
    },
  },
  output: {
    minify: false,
  },
  server: {
    publicDir: [
      { name: './src' },
    ],
    historyApiFallback: false,
  },
});
