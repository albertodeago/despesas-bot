import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../logger/mock";
import { getMockGoogleService } from "../services/google/mock";
import {
	_googleResultToCategories,
	type CategoriesUseCase,
	initCategoriesUseCase,
} from "./categories";

const spyRead = vi.fn(() =>
	Promise.resolve([
		// ['Categories', 'Sub-categories'], This is not returned
		["other"],
		["food", "grocery", "restaurant"],
		["home", "maintenance", "garden", "forniture", "other"],
	]),
);

const mockGoogleService = getMockGoogleService({
	spyRead,
});
const mockConfig = {
	CATEGORIES: {
		TAB_NAME: "tab-name",
		RANGE: "range",
	},
};
const mockLogger = getMockLogger();

describe("USE-CASE: categories", () => {
	let categories: CategoriesUseCase;

	beforeEach(() => {
		categories = initCategoriesUseCase({
			config: mockConfig,
			logger: mockLogger,
			googleService: mockGoogleService,
		});
		vi.clearAllMocks();
	});

	it("should return the categories from the specified sheetId", async () => {
		const result = await categories.get("sheet-id");

		// @ts-expect-error - not sure why but this has a wrong type
		const calledParams = spyRead.mock.calls[0][0] as unknown as {
			range: string;
			sheetId: string;
			tabName: string;
		};
		expect(calledParams.range).toEqual("range");
		expect(calledParams.tabName).toEqual("tab-name");
		expect(calledParams.sheetId).toEqual("sheet-id");
		expect(result.length).toEqual(3);
		expect(result[0].name).toEqual("other");
		expect(result[1].subCategories).toHaveLength(2);
		expect(result[2].subCategories).toHaveLength(4);
	});

	it("should cache the result and thus not refetching the categories if asked twice", async () => {
		const result = await categories.get("sheet-id");
		const cached = await categories.get("sheet-id");

		expect(result).toEqual(cached);
		expect(spyRead.mock.calls).toHaveLength(1);
	});
});

describe("googleResultToCategories", () => {
	describe("should map categories stored in a google sheet to Categories", () => {
		for (const expectation of expectations) {
			it(expectation.text, () => {
				expect(_googleResultToCategories(expectation.input)).toEqual(
					expectation.output,
				);
			});
		}
	});
});

const expectations = [
	{
		text: "With a mix of categories with and without subcategories",
		input: [
			["Category 1", "Subcategory 1", "Subcategory 2"],
			["Category 2", "Subcategory 3", "Subcategory 4"],
			["Category 3"],
		],
		output: [
			{
				name: "Category 1",
				subCategories: [
					{
						name: "Subcategory 1",
					},
					{
						name: "Subcategory 2",
					},
				],
			},
			{
				name: "Category 2",
				subCategories: [
					{
						name: "Subcategory 3",
					},
					{
						name: "Subcategory 4",
					},
				],
			},
			{
				name: "Category 3",
				subCategories: [],
			},
		],
	},
	{
		text: "With only categories without subcategories",
		input: [["Category 1"], ["Category 2"], ["Category 3"]],
		output: [
			{
				name: "Category 1",
				subCategories: [],
			},
			{
				name: "Category 2",
				subCategories: [],
			},
			{
				name: "Category 3",
				subCategories: [],
			},
		],
	},
	{
		text: "With only categories with subcategories",
		input: [
			["Category 1", "Subcategory 1", "Subcategory 2"],
			["Category 2", "Subcategory 3", "Subcategory 4"],
			["Category 3", "Subcategory 5", "Subcategory 6"],
		],
		output: [
			{
				name: "Category 1",
				subCategories: [
					{
						name: "Subcategory 1",
					},
					{
						name: "Subcategory 2",
					},
				],
			},
			{
				name: "Category 2",
				subCategories: [
					{
						name: "Subcategory 3",
					},
					{
						name: "Subcategory 4",
					},
				],
			},
			{
				name: "Category 3",
				subCategories: [
					{
						name: "Subcategory 5",
					},
					{
						name: "Subcategory 6",
					},
				],
			},
		],
	},
];
