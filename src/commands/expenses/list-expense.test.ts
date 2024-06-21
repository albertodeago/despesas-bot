import type TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../../logger/mock";
import { getMockGoogleService } from "../../services/google/mock";
import {
	getCommonMessageProperties,
	getMockBot,
	mockCategoriesUC,
	waitMessage,
} from "./fixture";
import { ListExpenseCommand } from "./list-expenses";

const mockGoogleService = getMockGoogleService();
const chatsConfigMocks = vi.hoisted(() => ({
	isChatActiveInConfiguration: () => Promise.resolve(true),
	getSpreadsheetIdFromChat: () => Promise.resolve("sheet-id"),
}));
vi.mock("../../use-cases/chats-configuration", () => ({
	isChatActiveInConfiguration: chatsConfigMocks.isChatActiveInConfiguration,
	getSpreadsheetIdFromChat: chatsConfigMocks.getSpreadsheetIdFromChat,
}));

const defaultMsg: TelegramBot.Message = {
	text: "lista spese Category_1 Subcategory_1",
	...getCommonMessageProperties(),
};

const mockBot = getMockBot(vi);
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

describe("AddExpenseCommand", () => {
	let handler: (msg: TelegramBot.Message) => void;

	beforeEach(() => {
		handler = ListExpenseCommand.getHandler({
			// @ts-expect-error
			bot: mockBot,
			categoriesUC: mockCategoriesUC,
			googleService: mockGoogleService,
			chatsConfigUC: mockChatsConfigUC,
			logger: mockLogger,
		});
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should match "lista spese"', () => {
		expect(ListExpenseCommand.pattern.test("lista spese")).toBe(true);
		expect(ListExpenseCommand.pattern.test("lista spese cat 1")).toBe(true);
		expect(ListExpenseCommand.pattern.test("lista spese cat 1 subcat 1")).toBe(
			true,
		);
		expect(ListExpenseCommand.pattern.test("lista")).toBe(false);
	});

	it("should send a explanation message if it doesn't have the category inserted", async () => {
		handler({ ...defaultMsg, text: "lista spese" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Per visualizzare le spese");
	});

	it("should answer with the subcategories if only category is inserted", async () => {
		handler({ ...defaultMsg, text: "lista spese Category_1" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			"La categoria Category_1 ha queste sottocategorie:\nSubcategory_1\nSubcategory_2",
		);
	});

	it("should answer with an error message if the category doesn't exist", async () => {
		handler({ ...defaultMsg, text: "lista spese Categ" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			"Non ho trovato la categoria Categ, sei sicuro di aver scritto giusto?",
		);
	});

	it("should answer with an error message if the subCategory doesn't exist", async () => {
		handler({ ...defaultMsg, text: "lista spese Category_1 SubCateg" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			"Non ho trovato la sotto categoria SubCateg, sei sicuro di aver scritto giusto?",
		);
	});

	it.todo(
		"should answer with the expenses of the category, if the category doesn't have subcategories",
	);

	it.todo("should answer with the expenses of the inserted subCategory");
});
