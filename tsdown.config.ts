import { defineConfig } from 'tsdown'

export default ['./src/content-script.ts', './src/runtime-api.ts', './src/background.ts'].map(entry => {
	return defineConfig({
		entry: [entry],
		format: ["iife"],
		clean: false,
		outputOptions: {
			entryFileNames: '[name].js',
		},
		noExternal: ["fuse.js"],
		outDir: 'extension/dist',
	})
})