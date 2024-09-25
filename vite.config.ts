/// <reference types="vitest/config" />
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
 
// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DimSumChat',
      fileName: 'dimsum-chat',
    },
  },
  plugins: [dts()],
  test: {
    // ... Specify options here.
  },
});