import type TelegramBot from "node-telegram-bot-api";
import type { CONFIG_TYPE } from "../../config/config";
import type { Logger } from "../../logger";
import type { GoogleService } from "../google";
import { getDateWithFallback, type RecurrentFrequency } from "./common";

export type Reminder = {
	index: number; // this is the row number in the google sheet, we use it as an identifier
	message: string;
	frequency: RecurrentFrequency;
	lastAddedDate: Date;
};

export type ReminderService = ReturnType<typeof initReminderService>;

type ReminderServiceParams = {
	googleService: GoogleService;
	config: Pick<CONFIG_TYPE, "REMINDERS" | "ADMINISTRATION_CHAT_ID">;
	logger: Logger;
	bot: TelegramBot;
};
export const initReminderService = ({
	googleService,
	config,
	logger,
	bot,
}: ReminderServiceParams) => {
	const onError = (e: Error) => {
		logger.error(e, "NO_CHAT");
		bot.sendMessage(config.ADMINISTRATION_CHAT_ID, `${e.message}: ${e}`);
	};

	const get = async (chatId: ChatId, spreadsheetId: SheetId) => {
		try {
			const rawReminders = await googleService.readGoogleSheet({
				sheetId: spreadsheetId,
				tabName: config.REMINDERS.TAB_NAME,
				range: config.REMINDERS.RANGE,
			});

			if (rawReminders && rawReminders.length > 0) {
				// first element is the header, we can skip it
				rawReminders.shift();

				// Remove every elements that has an invalid frequency
				// and if something is not ok, we can track the error AND alert the user!
				const validReminders: Reminder[] = rawReminders
					// we first map and then filter to have the indexes of the valid expenses that we will use as ID when updating
					.map((rawReminder, index) => {
						const errorMsg = checkReminder(rawReminder as ReminderRow);
						if (errorMsg) {
							logger.error(
								new Error(`Invalid reminder: ${errorMsg}`),
								"NO_CHAT",
							);
							bot.sendMessage(
								chatId,
								`Ho provato a leggere i promemoria, ma c'è stato un errore: ${errorMsg}\nDovresti sistermarlo nel tuo spreadsheet!`,
							);
							// return an invalid entry, it will be filtered out
							return {
								index,
								message: "",
								frequency: "invalid" as RecurrentFrequency,
								lastAddedDate: new Date(),
							};
						}

						return {
							index,
							message: rawReminder[0],
							frequency: rawReminder[1] as RecurrentFrequency,
							lastAddedDate: getDateWithFallback(rawReminder[2]),
						};
					})
					.filter((expense) =>
						["settimanale", "mensile", "bimestrale", "trimestrale"].includes(
							expense.frequency,
						),
					);

				return validReminders;
			}
		} catch (e) {
			onError(
				new Error(
					`Error while reading reminders: ${e}.\n Assicurati di avere la tab "${config.REMINDERS.TAB_NAME}" nel tuo spreadsheet!`,
				),
			);
		}

		return [];
	};

	const updateReminder = async (sheetId: SheetId, reminder: Reminder) => {
		try {
			const reminderIndex = reminder.index + 2; // +2 because the first row is the header and google sheets is 1-based
			const range = `A${reminderIndex}:F${reminderIndex}`;

			await googleService.updateGoogleSheet({
				sheetId,
				tabName: config.REMINDERS.TAB_NAME,
				range,
				data: [[reminder.message, reminder.frequency, reminder.lastAddedDate]],
			});
		} catch (e) {
			onError(
				new Error(
					`Error while updating last added date of a recurrent expense: ${e}`,
				),
			);
		}
	};

	return {
		get,
		updateReminder,
	};
};

type ReminderRow = [string, string, string, string];
const checkReminder = (reminderRow: ReminderRow): string | undefined => {
	let errorMsg: string | undefined;

	const [message, frequency, lastAddedDate] = reminderRow;
	if (!message) {
		errorMsg = "Message is required";
	} else if (
		!frequency ||
		["settimanale", "mensile", "bimestrale", "trimestrale"].includes(
			frequency,
		) === false
	) {
		errorMsg =
			"Frequency is required and must be settimanale, mensile, bimestrale o trimestrale";
	}

	return errorMsg;
};
