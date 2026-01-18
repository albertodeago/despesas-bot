import type TelegramBot from "node-telegram-bot-api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../../logger/mock";
import { StopCommand } from "./stop";

const mocks = vi.hoisted(() => ({
	spyReadGoogleSheet: vi.fn(() => Promise.resolve()), // just need to resolve
}));
vi.mock("../../google", () => ({
	readGoogleSheet: mocks.spyReadGoogleSheet,
}));

const bot = {
	sendMessage: vi.fn(),
};
const defaultMsg: TelegramBot.Message = {
	text: "/stop",
	chat: {
		id: 123,
		type: "private",
	},
	date: Date.now(),
	message_id: 987654321,
};
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
	getSpreadsheetIdFromChat: vi.fn((_p1: ChatId) =>
		Promise.resolve("spread-123"),
	),
};
const mockLogger = getMockLogger();
const mockConfig = {
	ADMINISTRATION_CHAT_ID: "admin-chat-id",
};

describe("StopCommand", () => {
	let handler: ReturnType<typeof StopCommand.getHandler>;

	beforeEach(() => {
		handler = StopCommand.getHandler({
			// @ts-expect-error
			bot,
			chatsConfigUC: mockChatsConfigUC,
			logger: mockLogger,
			config: mockConfig,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should match the command regex", () => {
		expect(StopCommand.pattern.test("/stop")).toBe(true);
		expect(StopCommand.pattern.test("/stop string")).toBe(true);
	});

	it("should answer with an error message if he doesn't find the sheet in the config", async () => {
		handler(defaultMsg);

		await vi.waitFor(() => {
			if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
				throw "Mock not called yet";
		});
		const calledWith = bot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(defaultMsg.chat.id);
		expect(calledWith[1]).toContain("Non risulta esserci");
	});

	it("should answer with an error message if he cannot read from the configuration", async () => {
		mockChatsConfigUC.isChatInConfiguration.mockImplementationOnce(() =>
			Promise.reject(),
		);
		handler(defaultMsg);

		await vi.waitFor(() => {
			if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
				throw "Mock not called yet";
		});
		const calledWith = bot.sendMessage.mock.calls[0];
		expect(calledWith[0]).toBe(defaultMsg.chat.id);
		expect(calledWith[1]).toContain("Non risulta esserci");
	});

	it("should update the chat configuration setting the chat to inactive ", async () => {
		mockChatsConfigUC.isChatInConfiguration.mockImplementationOnce(() =>
			Promise.resolve(true),
		);
		handler(defaultMsg);

		await vi.waitFor(() => {
			if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
				throw "Mock not called yet";
		});
		const calledWith =
			mockChatsConfigUC.updateChatInConfiguration.mock.calls[0];
		expect(calledWith[0]).toEqual("123");
		expect(calledWith[1]).toEqual({
			chatId: "123",
			spreadsheetId: "sheet-1",
			isActive: false,
		});
	});

	it("should send a msg to the admin when successful", async () => {
		mockChatsConfigUC.isChatInConfiguration.mockImplementationOnce(() =>
			Promise.resolve(true),
		);
		handler(defaultMsg);

		await vi.waitFor(() => {
			if (bot.sendMessage.mock.calls?.[1]?.[0] === undefined)
				throw "Mock not called yet";
		});
		const adminMsg = bot.sendMessage.mock.calls[1];
		expect(adminMsg[0]).toEqual("admin-chat-id");
		expect(adminMsg[1]).toContain("Bot stopped for chat 123");
	});
});
