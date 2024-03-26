import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../logger/mock";
import { getMockGoogleService } from "../services/google/mock";
import {
	type ChatsConfigurationUseCase,
	initChatsConfigurationUseCase,
} from "./chats-configuration";

const spyRead = vi.fn(() =>
	Promise.resolve([
		["chatId", "spreadsheetId", "isActive"],
		["chat-123", "spread-123", "TRUE"],
		["chat-456", "spread-456", "FALSE"],
		["chat-789", "spread-789", "TRUE"],
	]),
);
const spyAppend = vi.fn(() => Promise.resolve({ data: {} }));
const spyUpdate = vi.fn(() => Promise.resolve({ data: {} }));

const mockGoogleService = getMockGoogleService({
	spyRead,
	// @ts-expect-error
	spyAppend,
	// @ts-expect-error
	spyUpdate,
});

const mockConfig = {
	CHATS_CONFIGURATION: {
		SHEET_ID: "sheet-id",
		TAB_NAME: "tab-name",
		RANGE: "A:Z",
	},
};
const mockLogger = getMockLogger();

describe("USE-CASE: chats-configuration", () => {
	let chatConfigurationUC: ChatsConfigurationUseCase;
	beforeEach(() => {
		chatConfigurationUC = initChatsConfigurationUseCase({
			googleService: mockGoogleService,
			config: mockConfig,
			logger: mockLogger,
		});
		vi.clearAllMocks();
	});

	describe("getChatsConfiguration", () => {
		it("should return an empty array if there are no active chats", async () => {
			spyRead.mockImplementationOnce(() => Promise.resolve([]));

			const chatsConfig = await chatConfigurationUC.get();
			expect(chatsConfig).toEqual([]);
		});

		it("should return an empty array if an error happens while fetching the chats configuration", async () => {
			spyRead.mockImplementationOnce(() => Promise.reject());

			const chatsConfig = await chatConfigurationUC.get();
			expect(chatsConfig).toEqual([]);
		});

		it("should return the array of chat configurations (without the header row)", async () => {
			const chatsConfig = await chatConfigurationUC.get();
			expect(chatsConfig).toEqual([
				{
					chatId: "chat-123",
					spreadsheetId: "spread-123",
					isActive: true,
				},
				{
					chatId: "chat-456",
					spreadsheetId: "spread-456",
					isActive: false,
				},
				{
					chatId: "chat-789",
					spreadsheetId: "spread-789",
					isActive: true,
				},
			]);
		});

		it("should return the array of chat configurations removing any row with length !== 3", async () => {
			spyRead.mockImplementationOnce(() =>
				Promise.resolve([
					["chatId", "spreadsheetId", "isActive"],
					["chat-123", "spread-123", "TRUE"],
					[""],
					["chat-456", "spread-456", "FALSE", "madafacka"],
				]),
			);
			const chatsConfig = await chatConfigurationUC.get();
			expect(chatsConfig).toEqual([
				{
					chatId: "chat-123",
					spreadsheetId: "spread-123",
					isActive: true,
				},
			]);
		});

		it("should read values from cache if present", async () => {
			await chatConfigurationUC.get();
			expect(spyRead).toHaveBeenCalledOnce();

			await chatConfigurationUC.get();
			expect(spyRead).toHaveBeenCalledOnce();
		});
	});

	describe("isChatInConfiguration", () => {
		it("should return true if the chat is in the configuration", async () => {
			const res = await chatConfigurationUC.isChatInConfiguration("chat-123");
			expect(res).toEqual(true);
		});

		it("should return false if the chat is not in the configuration", async () => {
			const res = await chatConfigurationUC.isChatInConfiguration("chat-000");
			expect(res).toEqual(false);
		});

		it("should return false if an error occurs while fetching the chats configuration", async () => {
			spyRead.mockImplementationOnce(() => Promise.reject());

			const res = await chatConfigurationUC.isChatInConfiguration("chat-123");
			expect(res).toEqual(false);
		});
	});

	describe("addChatToConfiguration", () => {
		const mockChatConfig = {
			chatId: "chat-999",
			spreadsheetId: "spread-999",
			isActive: true,
		};

		it("should return false if an error occurs while appending the item", async () => {
			spyAppend.mockImplementationOnce(() => Promise.reject());

			const res =
				await chatConfigurationUC.addChatToConfiguration(mockChatConfig);
			expect(res).toEqual(false);
		});

		it("should return true if the append succeeds", async () => {
			const res =
				await chatConfigurationUC.addChatToConfiguration(mockChatConfig);
			expect(res).toEqual(true);
		});

		it("should update the value in cache if present", async () => {
			const currentCache = await chatConfigurationUC.get();

			await chatConfigurationUC.addChatToConfiguration(mockChatConfig);

			const newCache = await chatConfigurationUC.get();

			expect(currentCache).toHaveLength(3);
			expect(newCache).toHaveLength(4);
			const lastElement = newCache?.pop(); // remove last element, the newly added
			expect(currentCache).toEqual(newCache);
			expect(lastElement).toEqual(mockChatConfig);
		});
	});

	describe("updateChatInConfiguration", () => {
		const mockChatConfig = {
			chatId: "new-chat-id",
			spreadsheetId: "new-spread-id",
			isActive: true,
		};

		it("should return false if an error occurs while updating the value", async () => {
			spyUpdate.mockImplementationOnce(() => Promise.reject());

			const res = await chatConfigurationUC.updateChatInConfiguration(
				"chat-456",
				mockChatConfig,
			);
			expect(res).toEqual(false);
		});

		it("should return true if the update succeeds", async () => {
			const res = await chatConfigurationUC.updateChatInConfiguration(
				"chat-456",
				mockChatConfig,
			);
			expect(res).toEqual(true);
		});

		it("should update the value in cache if present", async () => {
			const currentCache = await chatConfigurationUC.get();

			await chatConfigurationUC.updateChatInConfiguration(
				"chat-456",
				mockChatConfig,
			);

			const newCache = await chatConfigurationUC.get();

			expect(currentCache).toHaveLength(3);
			expect(newCache).toHaveLength(3);
			expect(currentCache?.[1]).toEqual({
				chatId: "chat-456",
				spreadsheetId: "spread-456",
				isActive: false,
			});
			expect(newCache?.[1]).toEqual(mockChatConfig);
		});
	});

	describe("isChatActiveInConfiguration", () => {
		it("should return false if the chat is not found in the config", async () => {
			const result =
				await chatConfigurationUC.isChatActiveInConfiguration("chat-666");
			expect(result).toBe(false);
		});

		it("should return false if the chat is in the config but it' inactive", async () => {
			const result =
				await chatConfigurationUC.isChatActiveInConfiguration("chat-456");
			expect(result).toBe(false);
		});

		it("should return true if the chat is in the config and it's active", async () => {
			const result =
				await chatConfigurationUC.isChatActiveInConfiguration("chat-789");
			expect(result).toBe(true);
		});
	});

	describe("getSpreadsheetIdFromChat", () => {
		it("should throw an error if the requested chat is not found", async () => {
			await expect(() =>
				chatConfigurationUC.getSpreadsheetIdFromChat("chat-666"),
			).rejects.toThrowError("ChatConfigurationUseCase");
		});

		it("should return the spreadsheetId of the chatId", async () => {
			const result =
				await chatConfigurationUC.getSpreadsheetIdFromChat("chat-789");
			expect(result).toEqual("spread-789");
		});
	});
});
