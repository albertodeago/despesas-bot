import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../../utils';
import { getCategoriesAnswer } from './utils';

import type { ChatsConfigurationUseCase } from '../../use-cases/chats-configuration';
import type { CategoriesUseCase } from '../../use-cases/categories';

const GENERIC_ERROR_MSG = 'Si è verificato un errore, riprovare più tardi.';

type CategoriesCommandHandlerProps = {
  bot: TelegramBot;
  categoriesUC: CategoriesUseCase;
  chatsConfigUC: ChatsConfigurationUseCase;
};
export const CategoriesCommand: BotCommand<CategoriesCommandHandlerProps> = {
  pattern: /\/categorie(\s|$)|\/c(\s|$)/,
  getHandler:
    ({ bot, categoriesUC, chatsConfigUC }) =>
    async (msg: TelegramBot.Message) => {
      const { chatId, strChatId, tokens } = fromMsg(msg);
      console.log(
        `CategoriesCommand handler. Chat ${chatId}. Tokens ${tokens}`
      );

      try {
        // check, if it's a message in a inactive (on non existent) chat based on our
        // config, we can just skip it
        const _isChatActiveInConfiguration =
          await chatsConfigUC.isChatActiveInConfiguration(strChatId);
        if (!_isChatActiveInConfiguration) {
          return;
        }

        // get the spreadSheetId that we need to use to get the categories
        const spreadSheetId = await chatsConfigUC.getSpreadsheetIdFromChat(
          strChatId
        );

        // get the categories of the current chat
        const allCategories = await categoriesUC.get(spreadSheetId);

        if (tokens.length > 1) {
          // We want to answer with just the specified category
          const categoryName = tokens[1].toLowerCase();
          // TODO: can we make this more error friendly? (like typo tolerant)
          const category = allCategories.find(
            (c) => c.name.toLowerCase() === categoryName
          );

          if (!category) {
            // the user inserted a specific category but we couldn't find it
            // maybe he misspelled the category, we'll just answer with all the categories just in case
            bot.sendMessage(chatId, getCategoriesAnswer(allCategories), {
              parse_mode: 'Markdown',
            });
            return;
          }

          // the user inserted a specific category and we found it, answer with subcategories
          bot.sendMessage(chatId, getCategoriesAnswer([category]), {
            parse_mode: 'Markdown',
          });
        } else {
          // We want to answer with all the categories and subcategories
          bot.sendMessage(chatId, getCategoriesAnswer(allCategories), {
            parse_mode: 'Markdown',
          });
        }
        return;
      } catch (e) {
        console.error('An error ocurred handling the categories command', e);
        bot.sendMessage(chatId, GENERIC_ERROR_MSG);
      }
    },
};
