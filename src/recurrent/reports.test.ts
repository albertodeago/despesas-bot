import type TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../logger/mock";
import { getExpenseGrouped, initReports } from "./reports";

const stubs = vi.hoisted(() => ({
	getChart: () => Promise.resolve(Buffer.from("png image")),
}));
vi.mock("./chart/chart", () => ({ getChart: stubs.getChart }));

const mockBot = {
	sendMessage: vi.fn(),
	sendPhoto: vi.fn(),
};
const mockLogger = getMockLogger();

const mockChatsConfigUC = {
	isChatInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(false)),
	updateChatInConfiguration: vi.fn((p1: ChatId, p2: ChatConfig) =>
		Promise.resolve(true),
	),
	get: vi.fn(() =>
		Promise.resolve([
			{
				chatId: "123",
				spreadsheetId: "sheet-1",
				isActive: true,
			},
			{
				chatId: "-321",
				spreadsheetId: "sheet-2",
				isActive: true,
			},
			{
				chatId: "456",
				spreadsheetId: "sheet-3",
				isActive: false,
			},
		]),
	),
	addChatToConfiguration: vi.fn((p1: ChatConfig) => Promise.resolve(true)),
	isChatActiveInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(true)),
	getSpreadsheetIdFromChat: vi.fn((p1: ChatId) => Promise.resolve("sheet-id")),
};
const mockExpenseService = {
	getLastMonthExpenses: vi.fn(() =>
		Promise.resolve([
			{
				date: new Date("2024-01-01"),
				amount: 35,
				category: "food",
				subCategory: "groceries",
				description: "groceries",
			},
			{
				date: new Date("2024-01-01"),
				amount: 5,
				category: "food",
				subCategory: "groceries",
				description: "bread",
			},
			{
				date: new Date("2024-01-01"),
				amount: 100,
				category: "food",
				subCategory: "restaurants",
				description: "dinner",
			},
			{
				date: new Date("2024-01-01"),
				amount: 20,
				category: "other",
				subCategory: "subother 1",
				description: "",
			},
			{
				date: new Date("2024-01-01"),
				amount: 10,
				category: "other",
				subCategory: "subother 2",
				description: "",
			},
			{
				date: new Date("2024-01-01"),
				amount: 10,
				category: "NON CATEGORIZZATA",
				subCategory: "NON CATEGORIZZATA",
				description: "something",
			},
		]),
	),
};

const setIntervalMock = vi.fn();
vi.stubGlobal("setInterval", setIntervalMock);

// const setTimeoutMock = vi.fn((c) => c?.());
// vi.stubGlobal("setTimeout", setTimeoutMock);

const mockDateBefore = new Date("2024-01-15");
const mockDate = new Date("2024-02-01");

describe("Reports", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("getExpenseGrouped", () => {
		const mockedExpenses = [
			{
				date: new Date("2024-01-01"),
				amount: 35,
				category: "food",
				subCategory: "groceries",
				description: "groceries",
			},
			{
				date: new Date("2024-01-01"),
				amount: 5,
				category: "food",
				subCategory: "groceries",
				description: "bread",
			},
			{
				date: new Date("2024-01-01"),
				amount: 100,
				category: "food",
				subCategory: "restaurants",
				description: "dinner",
			},
			{
				date: new Date("2024-01-01"),
				amount: 20,
				category: "other",
				subCategory: "subother 1",
				description: "",
			},
			{
				date: new Date("2024-01-01"),
				amount: 10,
				category: "other",
				subCategory: "subother 2",
				description: "",
			},
			{
				date: new Date("2024-01-01"),
				amount: 10,
				category: "NON CATEGORIZZATA",
				subCategory: "NON CATEGORIZZATA",
				description: "something",
			},
		];

		it("should return the total expense", () => {
			const { totalExpense } = getExpenseGrouped(mockedExpenses);
			expect(totalExpense).toBe(180);
		});

		it("should return the expenses grouped by category", () => {
			const { expensesByCategory } = getExpenseGrouped(mockedExpenses);
			expect(expensesByCategory).toEqual({
				food: 140,
				other: 30,
				"NON CATEGORIZZATA": 10,
			});
		});

		it("should return the expenses grouped by subcategory", () => {
			const { expensesBySubCategory } = getExpenseGrouped(mockedExpenses);
			expect(expensesBySubCategory).toEqual({
				"food - groceries": 40,
				"food - restaurants": 100,
				"other - subother 1": 20,
				"other - subother 2": 10,
				"NON CATEGORIZZATA": 10,
			});
		});
	});

	describe("start", () => {
		it("should schedule a cron function every x time", () => {
			const reminderHandler = initReports({
				logger: mockLogger,
				chatsConfigUC: mockChatsConfigUC,
				bot: mockBot as unknown as TelegramBot,
				expenseService: mockExpenseService,
			});
			reminderHandler.start();

			expect(setIntervalMock).toHaveBeenCalledWith(
				reminderHandler.check,
				1000 * 60 * 60 * 10,
			);
		});
	});

	describe("check", () => {
		const reportsHandler = initReports({
			logger: mockLogger,
			chatsConfigUC: mockChatsConfigUC,
			bot: mockBot as unknown as TelegramBot,
			expenseService: mockExpenseService,
		});

		beforeEach(() => {
			vi.useFakeTimers();
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it("should do nothing if we are not in the first day of the month", async () => {
			vi.setSystemTime(new Date("2024-02-02"));
			await reportsHandler.check();

			expect(mockExpenseService.getLastMonthExpenses).not.toHaveBeenCalled();
			expect(mockBot.sendMessage).not.toHaveBeenCalled();
		});

		it("should send reports only to active chats", async () => {
			vi.setSystemTime(mockDate);
			await reportsHandler.check();

			expect(mockBot.sendMessage).toHaveBeenCalledTimes(4); // 4 is because it's 2 messages for each active chat
		});

		it("should send a message with the report by category", async () => {
			vi.setSystemTime(mockDateBefore);
			const reportsHandler = initReports({
				logger: mockLogger,
				chatsConfigUC: mockChatsConfigUC,
				bot: mockBot as unknown as TelegramBot,
				expenseService: mockExpenseService,
			});
			vi.setSystemTime(mockDate);
			await reportsHandler.check();

			const calls = mockBot.sendMessage.mock.calls;
			expect(calls[0][0]).toBe("123");
			expect(calls[0][1]).toEqual(
				"Le spese di gennaio sono state di 180€\n" +
					"- food (78%): 140€\n" +
					"- other (17%): 30€\n" +
					"- NON CATEGORIZZATA (6%): 10€\n",
			);
			expect(calls[2][0]).toBe("-321"); // second active chat
		});

		it("should send a message with the report by subCategory", async () => {
			vi.setSystemTime(mockDateBefore);
			const reportsHandler = initReports({
				logger: mockLogger,
				chatsConfigUC: mockChatsConfigUC,
				bot: mockBot as unknown as TelegramBot,
				expenseService: mockExpenseService,
			});
			vi.setSystemTime(mockDate);
			await reportsHandler.check();

			const calls = mockBot.sendMessage.mock.calls;
			expect(calls[1][0]).toBe("123");
			expect(calls[1][1]).toEqual(
				"Report per sotto-categorie:\n" +
					"- food - groceries(22%): 40€\n" +
					"- food - restaurants(56%): 100€\n" +
					"- other - subother 1(11%): 20€\n" +
					"- other - subother 2(6%): 10€\n" +
					"- NON CATEGORIZZATA(6%): 10€\n",
			);
			expect(calls[3][0]).toBe("-321"); // second active chat
		});

		it("should send a photo with the report by category and subCategory to active chats", async () => {
			vi.setSystemTime(mockDateBefore);
			const reportsHandler = initReports({
				logger: mockLogger,
				chatsConfigUC: mockChatsConfigUC,
				bot: mockBot as unknown as TelegramBot,
				expenseService: mockExpenseService,
			});
			vi.setSystemTime(mockDate);
			await reportsHandler.check();

			const calls = mockBot.sendPhoto.mock.calls;
			expect(calls).toHaveLength(4);
		});

		it("should not send the same report multiple times in the same day", async () => {
			vi.setSystemTime(mockDateBefore);
			const reportsHandler = initReports({
				logger: mockLogger,
				chatsConfigUC: mockChatsConfigUC,
				bot: mockBot as unknown as TelegramBot,
				expenseService: mockExpenseService,
			});
			vi.setSystemTime(mockDate);
			await reportsHandler.check();

			expect(mockBot.sendMessage).toHaveBeenCalledTimes(4); // 4 is because it's 2 messages for each active chat

			await reportsHandler.check();
			expect(mockBot.sendMessage).toHaveBeenCalledTimes(4); // 4 is because it's 2 messages for each active chat

			vi.setSystemTime(new Date("2024-03-01"));

			await reportsHandler.check();
			expect(mockBot.sendMessage).toHaveBeenCalledTimes(8);
		});
	});
});
