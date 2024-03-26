import type TelegramBot from "node-telegram-bot-api";
import type { CONFIG_TYPE } from "../../config/config";
import type { Logger } from "../../logger";
import { createExpenseRow, formatDate } from "../../utils";
import type { GoogleService } from "../google";
import { type RecurrentFrequency, getDateWithFallback } from "./common";

export type RecurrentExpense = {
	index: number; // this is the row number in the google sheet, we use it as an identifier
	category: string;
	subCategory?: string;
	message?: string;
	amount: number;
	frequency: RecurrentFrequency;
	lastAddedDate: Date;
};

export type RecurrentExpenseService = ReturnType<
	typeof initRecurrentExpenseService
>;

type RecurrentExpenseServiceParams = {
	googleService: GoogleService;
	config: Pick<
		CONFIG_TYPE,
		"RECURRENT_EXPENSES" | "EXPENSES" | "ADMINISTRATION_CHAT_ID"
	>;
	logger: Logger;
	bot: TelegramBot;
};
export const initRecurrentExpenseService = ({
	googleService,
	config,
	logger,
	bot,
}: RecurrentExpenseServiceParams) => {
	const onError = (e: Error) => {
		logger.error(e, "NO_CHAT");
		bot.sendMessage(config.ADMINISTRATION_CHAT_ID, `${e.message}: ${e}`);
	};

	const get = async (chatId: ChatId, spreadsheetId: SheetId) => {
		try {
			const recurrentExpenses = await googleService.readGoogleSheet({
				sheetId: spreadsheetId,
				tabName: config.RECURRENT_EXPENSES.TAB_NAME,
				range: config.RECURRENT_EXPENSES.RANGE,
			});

			if (recurrentExpenses && recurrentExpenses.length > 0) {
				// first element is the header, we can skip it
				recurrentExpenses.shift();

				// Remove every elements that has an invalid frequency
				// and if something is not ok, we can track the error AND alert the user!
				const validRecurrentExpenses: RecurrentExpense[] = recurrentExpenses
					// we first map and then filter to have the indexes of the valid expenses that we will use as ID when updating
					.map((expense, index) => {
						const errorMsg = checkRecurrentExpense(expense as ExpenseRow);
						if (errorMsg) {
							logger.error(
								new Error(`Invalid recurrent expense: ${errorMsg}`),
								"NO_CHAT",
							);
							bot.sendMessage(
								chatId,
								`Ho provato ad aggiungere una spesa ricorrente ma c'è stato un errore: Invalid recurrent expense: ${errorMsg}\nDovresti sistermarla nel tuo spreadsheet!`,
							);
							// return an invalid entry, it will be filtered out
							return {
								index,
								category: "",
								subCategory: "",
								message: "",
								amount: 0,
								frequency: "invalid" as RecurrentFrequency,
								lastAddedDate: new Date(),
							};
						}

						return {
							index,
							category: expense[0],
							subCategory: expense[1],
							message: expense[2],
							amount: Number.parseInt(expense[3]),
							frequency: expense[4] as RecurrentFrequency,
							lastAddedDate: getDateWithFallback(expense[5]),
						};
					})
					.filter((expense) =>
						["settimanale", "mensile", "bimestrale", "trimestrale"].includes(
							expense.frequency,
						),
					);

				return validRecurrentExpenses;
			}
		} catch (e) {
			onError(
				new Error(
					`Error while reading recurrent expenses: ${e}.\n Assicurati di avere la tab "${config.RECURRENT_EXPENSES.TAB_NAME}" nel tuo spreadsheet!`,
				),
			);
		}

		return [];
	};

	const updateRecurrentExpense = async (
		sheetId: SheetId,
		expense: RecurrentExpense,
	) => {
		try {
			const expenseIndex = expense.index + 2; // +2 because the first row is the header and google sheets is 1-based
			const range = `A${expenseIndex}:F${expenseIndex}`;

			await googleService.updateGoogleSheet({
				sheetId,
				tabName: config.RECURRENT_EXPENSES.TAB_NAME,
				range,
				data: [
					[
						expense.category,
						expense.subCategory,
						expense.message,
						expense.amount,
						expense.frequency,
						expense.lastAddedDate,
					],
				],
			});
		} catch (e) {
			onError(
				new Error(
					`Error while updating last added date of a recurrent expense: ${e}`,
				),
			);
		}
	};

	const addExpense = async (
		recurrentExpense: RecurrentExpense,
		spreadSheetId: SheetId,
	) => {
		const formattedDate = formatDate(new Date());
		const expenseRow = createExpenseRow({
			date: formattedDate,
			amount: recurrentExpense.amount,
			categoryName: recurrentExpense.category,
			subCategoryName: recurrentExpense.subCategory ?? "",
			description: recurrentExpense.message ?? "",
		});
		try {
			await googleService.appendGoogleSheet({
				sheetId: spreadSheetId,
				tabName: config.EXPENSES.TAB_NAME,
				range: config.EXPENSES.RANGE,
				data: expenseRow,
			});
		} catch (e) {
			onError(
				new Error(
					`Error while add an expense in the recurrentExpense Service: ${e}`,
				),
			);
		}
	};

	return {
		get,
		updateRecurrentExpense,
		addExpense,
	};
};

type ExpenseRow = [string, string, string, string, string, string];
const checkRecurrentExpense = (expenseRow: ExpenseRow): string | undefined => {
	let errorMsg: string | undefined = undefined;

	const [category, subCategory, message, amount, frequency, lastAddedDate] =
		expenseRow;
	if (!category) {
		errorMsg = "Category is required";
	} else if (!amount) {
		errorMsg = "Amount is required";
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
