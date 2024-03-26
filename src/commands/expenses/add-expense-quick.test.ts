import type TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNCATEGORIZED_CATEGORY } from "../../config/config";
import { getMockLogger } from "../../logger/mock";
import { getMockGoogleService } from "../../services/google/mock";
import { AddExpenseQuickCommand } from "./add-expense-quick";
import {
	getCommonMessageProperties,
	getMockAnalytics,
	getMockBot,
	mockConfig,
	waitMessage,
} from "./fixture";

const spyAppend = vi.fn(() => Promise.resolve());
// @ts-expect-error
const mockGoogleService = getMockGoogleService({ spyAppend });
const defaultMsg: TelegramBot.Message = {
	text: "aggiungi veloce 20 descrizione abbastanza lunga",
	...getCommonMessageProperties(),
};
const mockBot = getMockBot(vi);
const mockAnalytics = getMockAnalytics(vi);
const mockChatsConfigUC = {
	isChatInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(false)),
	updateChatInConfiguration: vi.fn((p1: ChatId, p2: ChatConfig) =>
		Promise.resolve(true),
	),
	get: vi.fn(() =>
		Promise.resolve([
			{
				chatId: "012",
				spreadsheetId: "sheet-0",
				isActive: true,
			},
			{
				chatId: "123",
				spreadsheetId: "sheet-1",
				isActive: true,
			},
		]),
	),
	addChatToConfiguration: vi.fn((p1: ChatConfig) => Promise.resolve(true)),
	isChatActiveInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(true)),
	getSpreadsheetIdFromChat: vi.fn((p1: ChatId) => Promise.resolve("sheet-id")),
};
const mockLogger = getMockLogger();

describe("AddExpenseQuickCommand", () => {
	let handler: ReturnType<typeof AddExpenseQuickCommand.getHandler>;

	beforeEach(() => {
		handler = AddExpenseQuickCommand.getHandler({
			// @ts-expect-error
			bot: mockBot,
			googleService: mockGoogleService,
			// @ts-expect-error
			analytics: mockAnalytics,
			// @ts-expect-error
			config: mockConfig,
			chatsConfigUC: mockChatsConfigUC,
			logger: mockLogger,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should match "aggiungi veloce"', () => {
		expect(AddExpenseQuickCommand.pattern.test("aggiungi ")).toBe(false);
		expect(AddExpenseQuickCommand.pattern.test("aggiungi")).toBe(false);
		expect(AddExpenseQuickCommand.pattern.test("aggiung")).toBe(false);
		expect(AddExpenseQuickCommand.pattern.test("aggiungi 10")).toBe(false);
		expect(AddExpenseQuickCommand.pattern.test("aggiungi veloce")).toBe(true);
		expect(AddExpenseQuickCommand.pattern.test("aggiungi vel")).toBe(false);
		expect(AddExpenseQuickCommand.pattern.test("aggiungi veloce 30,5")).toBe(
			true,
		);
		expect(
			AddExpenseQuickCommand.pattern.test(
				"aggiungi veloce 50 descrizione incredibile",
			),
		).toBe(true);
	});

	it("should send a explanation message if the amount is not a number", async () => {
		handler({ ...defaultMsg, text: "aggiungi veloce merda in salotto" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("L'importo dev'essere un numero");
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	it("should add the expense also if the message doesn't have a description (uncategorized)", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi veloce 20",
		});

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [
				["15/12/2023", 20, UNCATEGORIZED_CATEGORY, UNCATEGORIZED_CATEGORY, ""],
			],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should add the expense with the provided description (uncategorized)", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi veloce 20 descrizione",
		});

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [
				[
					"15/12/2023",
					20,
					UNCATEGORIZED_CATEGORY,
					UNCATEGORIZED_CATEGORY,
					"descrizione",
				],
			],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should add the expense with the provided long description (uncategorized)", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi veloce 20 descrizione incredibilmente verbosa",
		});

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [
				[
					"15/12/2023",
					20,
					UNCATEGORIZED_CATEGORY,
					UNCATEGORIZED_CATEGORY,
					"descrizione incredibilmente verbosa",
				],
			],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});
});
