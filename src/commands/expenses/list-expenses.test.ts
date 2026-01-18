import type TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../../logger/mock";
import { initExpenseService } from "../../services/expense";
import { getMockGoogleService } from "../../services/google/mock";
import type { Category } from "../../use-cases/categories";
import {
	getCommonMessageProperties,
	getMockBot,
	mockConfig,
	waitMessage,
} from "./fixture";
import { ListExpensesCommand } from "./list-expenses";

const spyRead = vi.fn(async () => [
	["date", "amount", "category", "subCategory", "description"],
	["01/12/2023", "20", "personal", "", ""],
	["10/12/2023", "100", "food", "groceries", "groceries for xmas"],
	["20/12/2023", "30", "gift", "flowers", "asd"],
	["30/12/2023", "40", "food", "groceries", "milk"],
	["01/01/2024", "10", "food", "groceries", ""],
	["20/01/2024", "120", "food", "restaurant", "fancy dinner"],
	["21/01/2024", "30", "personal", "", "private stuff"],
	["31/01/2024", "3.000,50", "trip", "hotel", "fancy hotel"],
	["01/02/2024", "30", "food", "groceries", "eggs"],
	["02/02/2024", "25", "personal", "", "another personal"],
]);
const mockGoogleService = getMockGoogleService({
	spyRead,
});

const mockCategoriesUC = {
	async get(): Promise<Category[]> {
		return [
			{
				name: "food",
				subCategories: [{ name: "groceries" }, { name: "restaurant" }],
			},
			{
				name: "trip",
				subCategories: [{ name: "hotel" }, { name: "flight" }],
			},
			{
				name: "personal",
				subCategories: [],
			},
		];
	},
};
const chatsConfigMocks = vi.hoisted(() => ({
	isChatActiveInConfiguration: () => Promise.resolve(true),
	getSpreadsheetIdFromChat: () => Promise.resolve("sheet-id"),
}));
vi.mock("../../use-cases/chats-configuration", () => ({
	isChatActiveInConfiguration: chatsConfigMocks.isChatActiveInConfiguration,
	getSpreadsheetIdFromChat: chatsConfigMocks.getSpreadsheetIdFromChat,
}));

const defaultMsg: TelegramBot.Message = {
	text: "lista spese food groceries",
	...getCommonMessageProperties(),
};

const mockBot = getMockBot(vi);
const mockChatsConfigUC = {
	isChatInConfiguration: vi.fn((_p1: ChatId) => Promise.resolve(false)),
	updateChatInConfiguration: vi.fn((_p1: ChatId, _p2: ChatConfig) =>
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
	addChatToConfiguration: vi.fn((_p1: ChatConfig) => Promise.resolve(true)),
	isChatActiveInConfiguration: vi.fn((_p1: ChatId) => Promise.resolve(true)),
	getSpreadsheetIdFromChat: vi.fn((_p1: ChatId) => Promise.resolve("sheet-id")),
};
const mockLogger = getMockLogger();
const mockExpenseService = initExpenseService({
	googleService: mockGoogleService,
	config: mockConfig,
});

describe("AddExpenseCommand", () => {
	let handler: (msg: TelegramBot.Message) => void;

	beforeEach(() => {
		handler = ListExpensesCommand.getHandler({
			// @ts-expect-error
			bot: mockBot,
			categoriesUC: mockCategoriesUC,
			expenseService: mockExpenseService,
			chatsConfigUC: mockChatsConfigUC,
			logger: mockLogger,
		});
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should match "lista spese"', () => {
		expect(ListExpensesCommand.pattern.test("lista spese")).toBe(true);
		expect(ListExpensesCommand.pattern.test("lista spese cat 1")).toBe(true);
		expect(ListExpensesCommand.pattern.test("lista spese cat 1 subcat 1")).toBe(
			true,
		);
		expect(ListExpensesCommand.pattern.test("lista")).toBe(false);
	});

	it("should send a explanation message if it doesn't have the category inserted", async () => {
		handler({ ...defaultMsg, text: "lista spese" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Per visualizzare le spese");
	});

	it("should answer with the subcategories if only category is inserted", async () => {
		handler({ ...defaultMsg, text: "lista spese food" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			"La categoria food ha queste sottocategorie:\ngroceries\nrestaurant",
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
		handler({ ...defaultMsg, text: "lista spese food crocchette" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			"Non ho trovato la sotto categoria crocchette, sei sicuro di aver scritto giusto?",
		);
	});

	it("should answer with the expenses of the category, if the category doesn't have subcategories", async () => {
		handler({ ...defaultMsg, text: "lista spese personal" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			`Ecco tutte le spese relative alla categoria personal
Totale spese: 75€
- 01/12/2023: 20€ (nessuna descrizione)
- 21/01/2024: 30€ (private stuff)
- 02/02/2024: 25€ (another personal)`,
		);
	});

	it("should answer with the expenses of the inserted subCategory", async () => {
		handler({ ...defaultMsg, text: "lista spese food groceries" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			`Ecco tutte le spese relative alla sottocategoria groceries (food)
Totale spese: 180€
- 10/12/2023: 100€ (groceries for xmas)
- 30/12/2023: 40€ (milk)
- 01/01/2024: 10€ (nessuna descrizione)
- 01/02/2024: 30€ (eggs)`,
		);
	});
});
