import type TelegramBot from "node-telegram-bot-api";

import type { Analytics } from "../analytics";
import type { Logger } from "../logger";
import type {
	RecurrentExpense,
	RecurrentExpenseService,
} from "../services/recurrent/expense";
import type { ChatsConfigurationUseCase } from "../use-cases/chats-configuration";

type InitRecurrentExpensesParams = {
	logger: Logger;
	bot: TelegramBot;
	chatsConfigUC: ChatsConfigurationUseCase;
	recurrentExpenseService: RecurrentExpenseService;
	analytics: Analytics;
};

const CHECK_INTERVAL = 1000 * 60 * 60; // 60 minutes

export const initRecurrentExpenses = ({
	logger,
	bot,
	chatsConfigUC,
	recurrentExpenseService,
	analytics,
}: InitRecurrentExpensesParams) => {
	let interval: NodeJS.Timeout | null = null;

	// Check recurrent expenses
	const check = async () => {
		// 1. read the chatConfiguration
		// 2. for each *active* chat, read the google sheet "spese-ricorrenti" tab
		// 3. for each expense, check if the expense is due
		// 4. if the expense is due, add the expense to the "spese" tab
		// 5. update the "last-added-date" column in the "spese-ricorrenti" tab
		// 6. send a message to the chat
		logger.debug("Checking recurrent expenses", "NO_CHAT");

		try {
			const activeChats = (await chatsConfigUC.get()).filter(
				(chat) => chat.isActive,
			);
			for (const chat of activeChats) {
				const strChatId = `${chat.chatId}`;
				logger.debug(
					`Checking recurrent expenses for chat ${chat.chatId}`,
					strChatId,
				);

				const recurrentExpenses = await recurrentExpenseService.get(
					chat.chatId,
					chat.spreadsheetId,
				);

				for (const recurrentExp of recurrentExpenses) {
					// Check if the expense is due
					if (isRecurrentExpenseDue(recurrentExp)) {
						logger.info(
							`Expense ${recurrentExp.index} ${recurrentExp.category} ${recurrentExp.message} ${recurrentExp.lastAddedDate} is due (frequency ${recurrentExp.frequency})`,
							"NO_CHAT",
						);

						// add the expense to the "spese" tab
						await recurrentExpenseService.addExpense(
							recurrentExp,
							chat.spreadsheetId,
						);
						analytics.addTrackedRecurrentExpense();

						// update the "last-added-date" column in the "spese-ricorrenti" tab
						await recurrentExpenseService.updateRecurrentExpense(
							chat.spreadsheetId,
							{
								...recurrentExp,
								lastAddedDate: new Date(),
							},
						);

						const message = createMessage(recurrentExp);
						bot.sendMessage(chat.chatId, message);
					} else {
						logger.debug(
							`Checked ${recurrentExp.index}-${recurrentExp.category} - not due ${recurrentExp.frequency} - ${recurrentExp.lastAddedDate}`,
							"NO_CHAT",
						);
					}
				}
			}
		} catch (e) {
			const err = new Error(`Error while checking recurrent expenses: ${e}`);
			logger.sendError(err, "NO_CHAT");
		}
	};

	// Check recurrent expenses every x time
	const start = () => {
		logger.info("Starting recurrent expenses", "NO_CHAT");
		interval = setInterval(check, CHECK_INTERVAL);
	};

	return {
		check, // mainly returned for testing purposes
		start,
	};
};

const isRecurrentExpenseDue = (expense: RecurrentExpense) => {
	const now = Date.now();
	const lastAddedTs = expense.lastAddedDate.getTime();
	const frequency = expense.frequency;

	// Check if the expense is due
	switch (frequency) {
		case "settimanale":
			return now > lastAddedTs + 1000 * 60 * 60 * 24 * 7;
		case "mensile":
			return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30;
		case "bimestrale":
			return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30 * 2;
		case "trimestrale":
			return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30 * 3;
		default:
			return false;
	}
};

const createMessage = (expense: RecurrentExpense) => {
	const subCategory = expense.subCategory ? ` - ${expense.subCategory}` : "";
	return `Spesa ricorrente aggiunta: ${expense.category}${subCategory} - ${expense.amount}€`;
};
