import type TelegramBot from "node-telegram-bot-api";
import { fromMsg } from "../../utils";
import { getCategoriesAnswer } from "./utils";

import type { Logger } from "../../logger";
import type { CategoriesUseCase } from "../../use-cases/categories";
import type { ChatsConfigurationUseCase } from "../../use-cases/chats-configuration";

const GENERIC_ERROR_MSG = "Si è verificato un errore, riprovare più tardi.";

type CategoriesCommandHandlerProps = {
	bot: TelegramBot;
	categoriesUC: CategoriesUseCase;
	chatsConfigUC: ChatsConfigurationUseCase;
	logger: Logger;
};
export const CategoriesCommand: BotCommand<CategoriesCommandHandlerProps> = {
	pattern: /\/categorie(\s|$)|\/c(\s|$)/,
	getHandler:
		({ bot, categoriesUC, chatsConfigUC, logger }) =>
		async (msg: TelegramBot.Message) => {
			const { chatId, strChatId, tokens } = fromMsg(msg);
			logger.info(`CategoriesCommand handler. Tokens ${tokens}`, strChatId);

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

				if (tokens.length > 1) {
					// We want to answer with just the specified category
					const categoryName = tokens[1].toLowerCase();
					const category = allCategories.find(
						(c) => c.name.toLowerCase() === categoryName,
					);

					if (!category) {
						// the user inserted a specific category but we couldn't find it
						// maybe he misspelled the category, we'll just answer with all the categories just in case
						bot.sendMessage(chatId, getCategoriesAnswer(allCategories), {
							parse_mode: "Markdown",
						});
						return;
					}

					// the user inserted a specific category and we found it, answer with subcategories
					bot.sendMessage(chatId, getCategoriesAnswer([category]), {
						parse_mode: "Markdown",
					});
				} else {
					// We want to answer with all the categories and subcategories
					bot.sendMessage(chatId, getCategoriesAnswer(allCategories), {
						parse_mode: "Markdown",
					});
				}
				return;
			} catch (e) {
				const err = new Error(
					`Error while handling the categories command: ${e}`,
				);
				logger.sendError(err, strChatId);
				bot.sendMessage(chatId, GENERIC_ERROR_MSG);
			}
		},
};
