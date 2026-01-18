import type TelegramBot from "node-telegram-bot-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockLogger } from "../../logger/mock";
import { getMockGoogleService } from "../google/mock";
import type { RecurrentFrequency } from "./common";
import { initReminderService } from "./reminder";

const spyRead = vi.fn(async () => [
	["message", "frequency", "lastAddedDate"],
	["Promemoria 1", "settimanale", ""],
	["Promemoria 2", "wrong", ""],
	["Promemoria 3", "mensile", ""],
	["Promemoria 4", "bimestrale", ""],
]);
const spyUpdate = vi.fn();
const spyAppend = vi.fn();

const mockConfig = {
	REMINDERS: {
		TAB_NAME: "tab",
		RANGE: "range",
	},
	ADMINISTRATION_CHAT_ID: "admin-chat-id",
};
const mockLogger = getMockLogger();
const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot;
const mockGoogleService = getMockGoogleService({
	spyRead,
	spyUpdate,
	spyAppend,
});

const newReminder = {
	index: 2,
	message: "Promemoria 1",
	frequency: "settimanale" as RecurrentFrequency,
	lastAddedDate: new Date("2024-01-01T00:00:00.000Z"),
};

describe("RreminderService", () => {
	const reminderService = initReminderService({
		googleService: mockGoogleService,
		config: mockConfig,
		logger: mockLogger,
		bot: mockBot,
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("get", () => {
		it("should return an empty array if there are no recurrent expenses", async () => {
			spyRead.mockImplementationOnce(() => Promise.resolve([]));
			const result = await reminderService.get("chatId", "spreadsheetId");
			expect(result).toEqual([]);
		});

		it("should return an array of reminders (filtering invalid entries)", async () => {
			const result = await reminderService.get("chatId", "spreadsheetId");
			expect(result).toEqual([
				{
					index: 0,
					message: "Promemoria 1",
					frequency: "settimanale",
					lastAddedDate: expect.any(Date),
				},
				{
					index: 2,
					message: "Promemoria 3",
					frequency: "mensile",
					lastAddedDate: expect.any(Date),
				},
				{
					index: 3,
					message: "Promemoria 4",
					frequency: "bimestrale",
					lastAddedDate: expect.any(Date),
				},
			]);
		});

		it("should alert the user if an entry have something invalid", async () => {
			await reminderService.get("chat-123", "spreadsheetId");
			expect(mockBot.sendMessage).toHaveBeenCalledWith(
				"chat-123",
				expect.stringContaining("Frequency is required"),
			);
		});
	});

	describe("updateReminder", () => {
		it("should update the last added date for the reminder", async () => {
			await reminderService.updateReminder("spreadsheetId", newReminder);
			expect(spyUpdate).toHaveBeenCalledWith({
				sheetId: "spreadsheetId",
				tabName: "tab",
				range: "A4:F4",
				data: [["Promemoria 1", "settimanale", newReminder.lastAddedDate]],
			});
		});
	});
});
