import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			reporter: ["html", "json-summary", "json"],
			provider: "v8",
		},
	},
});
