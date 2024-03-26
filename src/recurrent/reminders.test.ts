import type TelegramBot from "node-telegram-bot-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockAnalytics } from "../analytics/mock";
import { getMockLogger } from "../logger/mock";
import type { Reminder } from "../services/recurrent/reminder";
import { initReminders } from "./reminders";

const setIntervalMock = vi.fn();
vi.stubGlobal("setInterval", setIntervalMock);

const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot;
const loggerMock = getMockLogger();
const chatsConfigUCMock = {
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
const reminderServiceMock = {
	get: vi.fn((chatId) =>
		Promise.resolve(
			chatId !== "-321"
				? []
				: ([
						{
							index: 1,
							message: "msg1",
							frequency: "settimanale",
							lastAddedDate: new Date(
								new Date().setDate(new Date().getDate() - 10), // due because 10 days ago
							),
						},
						{
							index: 2,
							message: "msg2",
							frequency: "mensile",
							lastAddedDate: new Date(),
						},
						{
							index: 3,
							message: "msg3",
							frequency: "settimanale",
							lastAddedDate: new Date(),
						},
					] as Reminder[]),
		),
	),
	updateReminder: vi.fn(() => Promise.resolve()),
};
const mockAnalytics = getMockAnalytics();

describe("Reminders", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("start", () => {
		it("should schedule a cron function every x time", () => {
			const reminderHandler = initReminders({
				logger: loggerMock,
				chatsConfigUC: chatsConfigUCMock,
				bot: mockBot,
				reminderService: reminderServiceMock,
				analytics: mockAnalytics,
			});
			reminderHandler.start();

			expect(setIntervalMock).toHaveBeenCalledWith(
				reminderHandler.check,
				1000 * 60 * 60,
			);
		});
	});

	describe("check", () => {
		const reminderHandler = initReminders({
			logger: loggerMock,
			chatsConfigUC: chatsConfigUCMock,
			bot: mockBot,
			reminderService: reminderServiceMock,
			analytics: mockAnalytics,
		});

		it("should check all the reminders, update the due ones and send the message for them", async () => {
			await reminderHandler.check();
			expect(chatsConfigUCMock.get).toHaveBeenCalled();
			expect(reminderServiceMock.get).toHaveBeenCalled();
			expect(reminderServiceMock.updateReminder).toHaveBeenCalledWith(
				"sheet-2",
				{
					index: 1,
					message: "msg1",
					frequency: "settimanale",
					lastAddedDate: expect.any(Date),
				},
			);
			expect(mockAnalytics.addTrackedReminder).toHaveBeenCalled();
			expect(mockBot.sendMessage).toHaveBeenCalledWith(
				"-321",
				expect.any(String),
			);
		});

		it("should not send the message nor add the analytics if an error occurs", async () => {
			reminderServiceMock.get.mockImplementationOnce(async () => {
				throw new Error("Error");
			});
			await reminderHandler.check();
			expect(chatsConfigUCMock.get).toHaveBeenCalled();
			expect(reminderServiceMock.get).toHaveBeenCalled();
			expect(reminderServiceMock.updateReminder).not.toHaveBeenCalled();
			expect(mockAnalytics.addTrackedReminder).not.toHaveBeenCalled();
			expect(mockBot.sendMessage).not.toHaveBeenCalled();
		});

		it("should not check the reminders for inactive chats", async () => {
			await reminderHandler.check();
			expect(chatsConfigUCMock.get).toHaveBeenCalled();
			const calls = reminderServiceMock.get.mock.calls;
			expect(calls[0][0]).toBe("123");
			expect(calls[1][0]).toBe("-321");
			expect(calls).toHaveLength(2);
		});
	});
});
