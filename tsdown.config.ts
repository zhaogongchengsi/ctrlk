import { defineConfig } from 'tsdown'
import pkg from './package.json' assert { type: 'json' }

export default ['./src/content-script.ts', './src/runtime-api.ts', './src/background.ts'].map(entry => {
	return defineConfig({
		entry: [entry],
		format: ["iife"],
		clean: false,
		outputOptions: {
			entryFileNames: '[name].js',
		},
		define: {
			"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || 'development'),
		},
		noExternal: ["rxjs/operators", ...Object.keys(pkg.dependencies || {})],
		outDir: 'extension/dist',
	})
})