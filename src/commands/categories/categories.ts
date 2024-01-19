import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../../utils';
import { Category } from './fetch';

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

export const CategoriesCommand: BotCommand = {
  pattern: /\/categorie(\s|$)|\/c(\s|$)/,
  getHandler:
    (bot: TelegramBot, allCategories: Category[]) =>
    async (msg: TelegramBot.Message) => {
      const { chatId, tokens } = fromMsg(msg);
      console.log(
        `CategoriesCommand handler. Chat ${chatId}. Tokens ${tokens}`
      );

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
    },
};
