import type TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../../logger/mock";
import { getMockGoogleService } from "../../services/google/mock";
import {
	AddExpenseCommand,
	getCategoryAndSubcategoryHandler,
	getSubcategoryHandler,
} from "./add-expense";
import {
	getCommonMessageProperties,
	getMockAnalytics,
	getMockBot,
	mockCategoriesUC,
	mockConfig,
	waitMessage,
} from "./fixture";

const spyAppend = vi.fn(() => Promise.resolve());
const mockGoogleService = getMockGoogleService({
	// @ts-expect-error
	spyAppend,
});
const chatsConfigMocks = vi.hoisted(() => ({
	isChatActiveInConfiguration: () => Promise.resolve(true),
	getSpreadsheetIdFromChat: () => Promise.resolve("sheet-id"),
}));
vi.mock("../../use-cases/chats-configuration", () => ({
	isChatActiveInConfiguration: chatsConfigMocks.isChatActiveInConfiguration,
	getSpreadsheetIdFromChat: chatsConfigMocks.getSpreadsheetIdFromChat,
}));

const defaultMsg: TelegramBot.Message = {
	text: "aggiungi 20 descrizione Category_1 Subcategory_1",
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

describe("AddExpenseCommand", () => {
	let handler: (msg: TelegramBot.Message) => void;

	beforeEach(() => {
		handler = AddExpenseCommand.getHandler({
			// @ts-expect-error
			bot: mockBot,
			categoriesUC: mockCategoriesUC,
			// @ts-expect-error
			analytics: mockAnalytics,
			googleService: mockGoogleService,
			// @ts-expect-error
			config: mockConfig,
			chatsConfigUC: mockChatsConfigUC,
			logger: mockLogger,
		});
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should match "aggiungis*((?!veloce).)*$"', () => {
		expect(AddExpenseCommand.pattern.test("aggiungi")).toBe(true);
		expect(AddExpenseCommand.pattern.test("aggiungi ")).toBe(true);
		expect(AddExpenseCommand.pattern.test("aggiung")).toBe(false);
		expect(AddExpenseCommand.pattern.test("aggiungi 10")).toBe(true);
		expect(AddExpenseCommand.pattern.test("aggiungi veloce")).toBe(false);
		expect(AddExpenseCommand.pattern.test("aggiungi vel")).toBe(true);
	});

	it("should send a explanation message if it doesn't have the necessary info to answer", async () => {
		handler({ ...defaultMsg, text: "aggiungi" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Per aggiungere una spesa, scrivere");
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	it("should send a explanation message if the amount is not a number", async () => {
		handler({ ...defaultMsg, text: "aggiungi merda in casa" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("L'importo dev'essere un numero");
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	it("should add the expense if the message finish with a category with no subcategories", async () => {
		handler({ ...defaultMsg, text: "aggiungi 20 descrizione Category_3" });

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [["15/12/2023", 20, "Category_3", "", "descrizione"]],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should add the expense if the message finish with a category with no subcategories (including typo)", async () => {
		handler({ ...defaultMsg, text: "aggiungi 20 descrizione Category_33" });

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [["15/12/2023", 20, "Category_3", "", "descrizione"]],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should ask for the subcategory if the message doesn't finish with a category with no subcategories", async () => {
		handler({ ...defaultMsg, text: "aggiungi 20 descrizione Category_1" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Scegli una sottocategoria");

		// we also set a once listener after this
		expect(mockBot.once).toHaveBeenCalled(); // tested with getSubcategoryHandler
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	it("should ask for the subcategory if the message doesn't finish with a category with no subcategories (including typo)", async () => {
		handler({ ...defaultMsg, text: "aggiungi 20 descrizione Cagory_1" });

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Scegli una sottocategoria");

		// we also set a once listener after this
		expect(mockBot.once).toHaveBeenCalled(); // tested with getSubcategoryHandler
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	it("should send an error message if the second last token is a category but the last one is not a subcategory", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi 20 descrizione Category_1 merda",
		});

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain(
			"Non sono riuscito ad individuare la categoria e sotto categoria, reinserisci la spesa",
		);
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	it("should add the expense if the message finish with a category and subcategory", async () => {
		handler(defaultMsg);

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [["15/12/2023", 20, "Category_1", "Subcategory_1", "descrizione"]],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should add the expense if the message finish with a category and subcategory (with typo)", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi 20 descrizione Category_1 Subcategory_11",
		});

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [["15/12/2023", 20, "Category_1", "Subcategory_1", "descrizione"]],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should add the expense if the message finish with a category and subcategory (with double typo)", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi 20 descrizione Categor_11 Subcategor_11",
		});

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [["15/12/2023", 20, "Category_1", "Subcategory_1", "descrizione"]],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should add the expense also if the message doesn't have a description", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi 20 Category_1 Subcategory_1",
		});

		await waitMessage(vi, mockBot);
		expect(spyAppend).toHaveBeenCalledWith({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:Z",
			data: [["15/12/2023", 20, "Category_1", "Subcategory_1", ""]],
		});
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Fatto!");
		expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
	});

	it("should ask to select a category if the message doesn't provide one", async () => {
		handler({
			...defaultMsg,
			text: "aggiungi 20 descrizione del cazzo ma senza una categoria",
		});

		await waitMessage(vi, mockBot);
		const calledWith = mockBot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(123);
		expect(calledWith[1]).toContain("Scegli una categoria");
		expect(mockBot.once).toHaveBeenCalled(); // tested with getCategoryAndSubcategoryHandler
		expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
	});

	describe("getCategoryAndSubcategoryHandler", () => {
		const getHandler = async () =>
			getCategoryAndSubcategoryHandler({
				// @ts-expect-error
				bot: mockBot,
				googleService: mockGoogleService,
				allCategories: await mockCategoriesUC.get(),
				chatId: 123,
				tokens: ["aggiungi", "20", "descrizione", "multi", "token"],
				formattedDate: "15/12/2023",
				amount: 50,
				// @ts-expect-error
				analytics: mockAnalytics,
				// @ts-expect-error
				config: mockConfig,
				spreadSheetId: "sheet-id",
			});

		it("should send an error message if the category doesn't exist", async () => {
			const categoryHandler = await getHandler();
			await categoryHandler({ ...defaultMsg, text: "not-existing" });

			expect(mockBot.sendMessage).toHaveBeenCalledWith(
				123,
				"Cè stato un problema, reinserisci la spesa\n",
			);
			expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
		});

		it("should insert the expense if the selected category doesn't have subcategories", async () => {
			const categoryHandler = await getHandler();
			await categoryHandler({ ...defaultMsg, text: "Category_3" });

			await waitMessage(vi, mockBot);
			expect(spyAppend).toHaveBeenCalledWith({
				sheetId: "sheet-id",
				tabName: "tab-name",
				range: "A:Z",
				data: [["15/12/2023", 50, "Category_3", "", "descrizione multi token"]],
			});
			const calledWith = mockBot.sendMessage.mock.calls[0];
			expect(calledWith[0]).toBe(123);
			expect(calledWith[1]).toContain("Fatto!");
			expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
		});

		it("should ask for the subcategory if the selected category have subcategories", async () => {
			const categoryHandler = await getHandler();
			await categoryHandler({ ...defaultMsg, text: "Category_1" });

			const calledWith = mockBot.sendMessage.mock.calls[0];
			expect(calledWith[0]).toBe(123);
			expect(calledWith[1]).toContain("Scegli una sottocategoria");
			expect(mockBot.once).toHaveBeenCalled(); // tested with getSubcategoryHandler
			expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
		});
	});

	describe("getSubcategoryHandler", () => {
		const getHandler = async () =>
			getSubcategoryHandler({
				// @ts-expect-error
				bot: mockBot,
				googleService: mockGoogleService,
				category: (await mockCategoriesUC.get())[0],
				chatId: 123,
				description: "descrizione multi token",
				formattedDate: "15/12/2023",
				amount: 20,
				// @ts-expect-error
				analytics: mockAnalytics,
				// @ts-expect-error
				config: mockConfig,
				spreadSheetId: "sheet-id",
			});

		it("should send an error message if the subcategory doesn't exist", async () => {
			const subCategoryHandler = await getHandler();
			await subCategoryHandler({ ...defaultMsg, text: "not-existing" });

			expect(mockBot.sendMessage).toHaveBeenCalledWith(
				123,
				"Cè stato un problema, reinserisci la spesa\n",
			);
			expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
		});

		it("should add the expense if the subcategory is correct", async () => {
			const subCategoryHandler = await getHandler();
			await subCategoryHandler({ ...defaultMsg, text: "Subcategory_1" });

			await waitMessage(vi, mockBot);
			expect(spyAppend).toHaveBeenCalledWith({
				sheetId: "sheet-id",
				tabName: "tab-name",
				range: "A:Z",
				data: [
					[
						"15/12/2023",
						20,
						"Category_1",
						"Subcategory_1",
						"descrizione multi token",
					],
				],
			});
			const calledWith = mockBot.sendMessage.mock.calls[0];
			expect(calledWith[0]).toBe(123);
			expect(calledWith[1]).toContain("Fatto!");
			expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
		});
	});
});
