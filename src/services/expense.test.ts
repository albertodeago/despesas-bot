import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initExpenseService } from "./expense";
import { getMockGoogleService } from "./google/mock";

const spyRead = vi.fn(async () => [
	["date", "amount", "category", "subCategory", "description"],
	["01/12/2023", "20", "personal", "", ""],
	["20/12/2023", "30", "gift", "flowers", "asd"],
	["30/12/2023", "40", "food", "groceries", "milk"],
	["01/01/2024", "10", "food", "groceries", "bread"],
	["20/01/2024", "30", "food", "groceries", "eggs"],
	["25/01/2024", "30", "food", "groceries", "eggs"],
	["26/01/2024", "30", "food", "groceries", "eggs"],
	["27/01/2024", "30", "food", "groceries", "eggs"],
	["27/01/2024", "30", "food", "groceries", "eggs"],
	["30/01/2024", "30", "food", "groceries", "eggs"],
	["01/02/2024", "30", "food", "groceries", "eggs"],
	["10/02/2024", "30", "food", "groceries", "eggs"],
]);
const mockGoogleService = getMockGoogleService({
	spyRead,
});

const mockConfig = {
	EXPENSES: {
		RANGE: "A1:E100",
		TAB_NAME: "expenses",
	},
};

const expectedExpenses = [
	{
		date: new Date("2024-01-01T08:00:00Z"),
		amount: 10,
		category: "food",
		subCategory: "groceries",
		description: "bread",
	},
	{
		date: new Date("2024-01-20T08:00:00Z"),
		amount: 30,
		category: "food",
		subCategory: "groceries",
		description: "eggs",
	},
	{
		date: new Date("2024-01-25T08:00:00Z"),
		amount: 30,
		category: "food",
		subCategory: "groceries",
		description: "eggs",
	},
	{
		date: new Date("2024-01-26T08:00:00Z"),
		amount: 30,
		category: "food",
		subCategory: "groceries",
		description: "eggs",
	},
	{
		date: new Date("2024-01-27T08:00:00Z"),
		amount: 30,
		category: "food",
		subCategory: "groceries",
		description: "eggs",
	},
	{
		date: new Date("2024-01-27T08:00:00Z"),
		amount: 30,
		category: "food",
		subCategory: "groceries",
		description: "eggs",
	},
	{
		date: new Date("2024-01-30T08:00:00Z"),
		amount: 30,
		category: "food",
		subCategory: "groceries",
		description: "eggs",
	},
];

// mock new Date() to return a fixed date
const mockDate = new Date("2024-02-01T00:00:00Z");

describe("Expense Service", () => {
	describe("getLastMonthExpenses", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(mockDate);
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it("should return the last month expenses", async () => {
			const expenseService = initExpenseService({
				googleService: mockGoogleService,
				config: mockConfig,
			});
			const lastMonthExpenses = await expenseService.getLastMonthExpenses({
				sheetId: "sheetId",
			});
			expect(lastMonthExpenses).toHaveLength(7);
			expect(lastMonthExpenses).toEqual(expectedExpenses);
		});

		it("should return the last month expenses even if we are at half month", async () => {
			const mockDate = new Date("2024-02-15T00:00:00Z");
			vi.setSystemTime(mockDate);
			const expenseService = initExpenseService({
				googleService: mockGoogleService,
				config: mockConfig,
			});
			const lastMonthExpenses = await expenseService.getLastMonthExpenses({
				sheetId: "sheetId",
			});
			expect(lastMonthExpenses).toHaveLength(7);
			expect(lastMonthExpenses).toEqual(expectedExpenses);
		});

		it("should return the last month expenses even if we are on 1° january", async () => {
			const mockDate = new Date("2024-01-01T00:00:00Z");
			vi.setSystemTime(mockDate);
			const expenseService = initExpenseService({
				googleService: mockGoogleService,
				config: mockConfig,
			});
			const lastMonthExpenses = await expenseService.getLastMonthExpenses({
				sheetId: "sheetId",
			});
			expect(lastMonthExpenses).toHaveLength(3);
			expect(lastMonthExpenses).toEqual([
				{
					date: new Date("2023-12-01T08:00:00Z"),
					amount: 20,
					category: "personal",
					subCategory: "",
					description: "",
				},
				{
					date: new Date("2023-12-20T08:00:00Z"),
					amount: 30,
					category: "gift",
					subCategory: "flowers",
					description: "asd",
				},
				{
					date: new Date("2023-12-30T08:00:00Z"),
					amount: 40,
					category: "food",
					subCategory: "groceries",
					description: "milk",
				},
			]);
		});
	});
});
