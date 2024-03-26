import { vi } from "vitest";

export const getMockLogger = () => {
	return {
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		sendInfo: vi.fn(),
		sendError: vi.fn(),
	};
};
