import type { VitestUtils } from "vitest";
import type { Category } from "../../use-cases/categories";

export const waitMessage = async (vi: VitestUtils, bot: any) => {
	await vi.waitFor(() => {
		if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
			throw "Mock not called yet";
	});
};

export const getMockAnalytics = (vi: VitestUtils) => ({
	addTrackedExpense: vi.fn(),
});

export const getMockBot = (vi: VitestUtils) => ({
	sendMessage: vi.fn(),
	once: vi.fn(),
});

export const mockConfig = {
	EXPENSES: {
		TAB_NAME: "tab-name",
		RANGE: "A:Z",
	},
};

export const getCommonMessageProperties = (): {
	chat: {
		id: number;
		type: "private";
	};
	date: number;
	message_id: number;
} => ({
	chat: {
		id: 123,
		type: "private",
	},
	date: 1702637184, // telegram date is a bit weird, it's a timestamp / 1000
	message_id: 987654321,
});

export const mockCategoriesUC = {
	async get(): Promise<Category[]> {
		return [
			{
				name: "Category_1",
				subCategories: [{ name: "Subcategory_1" }, { name: "Subcategory_2" }],
			},
			{
				name: "Category_2",
				subCategories: [{ name: "Subcategory_3" }, { name: "Subcategory_4" }],
			},
			{
				name: "Category_3",
				subCategories: [],
			},
		];
	},
};
