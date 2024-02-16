import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../../utils';
import { Category } from './fetch';
import {
  isChatActiveInConfiguration,
  getSpreadsheetIdFromChat,
} from '../../use-cases/chats-configuration';
// import { getSpread } from '../../use-cases/categories';
import { sheets_v4 } from 'googleapis';
import { CONFIG_TYPE } from '../../config/config';
import { Categories } from '../../use-cases/categories';

const GENERIC_ERROR_MSG = 'Si è verificato un errore, riprovare più tardi.';

// construct the message to send to the user from a list of categories
const getCategoriesAnswer = (categories: Category[]) => {
  let answer =
    categories.length === 1
      ? `Ecco le sottocategorie di *${categories[0].name}*`
      : `Ecco le categorie\n`;
  categories.forEach((category) => {
    answer += categories.length === 1 ? '\n' : `- *${category.name}* \n`;
    if (category.subCategories.length > 0) {
      answer += `  - ${category.subCategories
        .map((sc) => sc.name)
        .join(', ')} \n`;
    }
  });
  return answer;
};

type CategoriesCommandHandlerProps = {
  bot: TelegramBot;
  googleSheetClient: sheets_v4.Sheets;
  config: CONFIG_TYPE;
  // allCategories: Category[];
  categoriesUC: Categories;
};
export const CategoriesCommand: BotCommand<CategoriesCommandHandlerProps> = {
  pattern: /\/categorie(\s|$)|\/c(\s|$)/,
  getHandler:
    ({ bot, googleSheetClient, config, categoriesUC }) =>
    async (msg: TelegramBot.Message) => {
      const { chatId, strChatId, tokens } = fromMsg(msg);
      console.log(
        `CategoriesCommand handler. Chat ${chatId}. Tokens ${tokens}`
      );

      try {
        // check, if it's a message in a inactive (on non existent) chat based on our
        // config, we can just skip it
        const _isChatActiveInConfiguration = await isChatActiveInConfiguration(
          googleSheetClient,
          config,
          strChatId
        );
        if (!_isChatActiveInConfiguration) {
          return;
        }

        // get the spreadSheetId that we need to use to get the categories
        const spreadSheetId = await getSpreadsheetIdFromChat(
          googleSheetClient,
          config,
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
