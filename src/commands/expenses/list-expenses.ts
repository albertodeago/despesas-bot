import { formatDate, fromMsg, includesConsideringTypo } from "../../utils";
import { getMsgExplanationList } from "./messages";

import type TelegramBot from "node-telegram-bot-api";
import type { Logger } from "../../logger";
import type { ExpenseService } from "../../services/expense";
import type { CategoriesUseCase } from "../../use-cases/categories";
import type { ChatsConfigurationUseCase } from "../../use-cases/chats-configuration";

const GENERIC_ERROR_MSG = "Si è verificato un errore, riprovare più tardi.";

type ListExpenseProps = {
	bot: TelegramBot;
	categoriesUC: CategoriesUseCase;
	expenseService: ExpenseService;
	chatsConfigUC: ChatsConfigurationUseCase;
	logger: Logger;
};
export const ListExpensesCommand: BotCommand<ListExpenseProps> = {
	pattern: /^lista spese/i,
	getHandler:
		({ bot, categoriesUC, expenseService, chatsConfigUC, logger }) =>
		async (msg: TelegramBot.Message) => {
			const { chatId, strChatId, tokens, date } = fromMsg(msg);
			logger.info(`ListExpensesCommand handler. Tokens ${tokens}`, strChatId);

			try {
				// check, if it's a message in a inactive (on non existent) chat based on our
				// config, we can just skip it
				const _isChatActiveInConfiguration =
					await chatsConfigUC.isChatActiveInConfiguration(strChatId);
				if (!_isChatActiveInConfiguration) {
					return;
				}

				// get the spreadSheetId that we need to use to get the categories
				const spreadSheetId =
					await chatsConfigUC.getSpreadsheetIdFromChat(strChatId);

				// get the categories of the current chat
				const allCategories = await categoriesUC.get(spreadSheetId);
				const categoriesFlat = allCategories.map((c) => c.name);

				// we need at least 'lista spese <categoria>'
				if (tokens.length < 3) {
					bot.sendMessage(chatId, getMsgExplanationList());
					return;
				}

				if (tokens.length === 3) {
					// User inserted only the category.
					// Check if the category has subCategories, if yes, we
					// send a message with the subcategories
					// if not, we send the expenses of that category
					const category = includesConsideringTypo(categoriesFlat, tokens[2]);
					if (!category) {
						bot.sendMessage(
							chatId,
							`Non ho trovato la categoria ${tokens[2]}, sei sicuro di aver scritto giusto?`,
						);
						return;
					}

					const categoryObj = allCategories.find((c) => c.name === category);
					if (!categoryObj) {
						throw new Error(
							`Category not found, should've found a category ${category} (text was ${tokens[2]}), but didn't happen`,
						);
					}

					if (categoryObj.subCategories.length === 0) {
						// the category doesn't have any subcategories, we can send the expenses
						const expenses = await expenseService.getAllExpenses({
							sheetId: spreadSheetId,
							filters: { categoryName: category },
						});

						const expenseMsg = expenses
							.map(
								(e) =>
									`- ${formatDate(e.date)}: ${e.amount}€ (${e.description || "nessuna descrizione"})`,
							)
							.join("\n");
						bot.sendMessage(
							chatId,
							`Ecco tutte le spese relative alla categoria ${categoryObj.name}\n${expenseMsg}`,
						);
					} else {
						// the category has subcategories, we need to show them
						const subCategories = categoryObj.subCategories.map(
							(sc) => sc.name,
						);
						bot.sendMessage(
							chatId,
							`La categoria ${categoryObj.name} ha queste sottocategorie:\n${subCategories.join(
								"\n",
							)}`,
						);
					}
					return;
				}
				if (tokens.length === 4) {
					// User inserted the category and the subcategory
					// we can send the expenses of that subcategory
					const matchedCategory = includesConsideringTypo(
						categoriesFlat,
						tokens[2],
					);
					if (!matchedCategory) {
						bot.sendMessage(chatId, "Categoria non trovata");
						return;
					}
					const category = allCategories.find(
						(c) => c.name === matchedCategory,
					);
					if (!category) {
						throw new Error(
							`Category not found, should've found a category ${matchedCategory} (text was ${tokens[2]}), but didn't happen`,
						);
					}
					const matchedSubCategory = includesConsideringTypo(
						category?.subCategories.map((c) => c.name),
						tokens[3],
					);
					if (!matchedSubCategory) {
						bot.sendMessage(
							chatId,
							`Non ho trovato la sotto categoria ${tokens[3]}, sei sicuro di aver scritto giusto?`,
						);
						return;
					}

					const expenses = await expenseService.getAllExpenses({
						sheetId: spreadSheetId,
						filters: {
							categoryName: matchedCategory,
							subCategoryName: matchedSubCategory,
						},
					});

					const expenseMsg = expenses
						.map(
							(e) =>
								`- ${formatDate(e.date)}: ${e.amount}€ (${e.description || "nessuna descrizione"})`,
						)
						.join("\n");
					bot.sendMessage(
						chatId,
						`Ecco tutte le spese relative alla sottocategoria ${matchedSubCategory} (${matchedCategory})\n${expenseMsg}`,
					);
					return;
				}
			} catch (e) {
				const err = new Error(
					`Error while handling the list-expenses command: ${e}`,
				);
				logger.sendError(err, strChatId);
				bot.sendMessage(chatId, GENERIC_ERROR_MSG);
			}
		},
};
