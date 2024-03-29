import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globalSetup: "./vitest.global-setup.ts",
		coverage: {
			reporter: ["html", "json-summary", "json"],
			provider: "v8",
		},
	},
});
