import TelegramBot from 'node-telegram-bot-api';
import { Category } from '../categories/fetch';
import {
  fromMsg,
  createExpenseRow,
  getDescriptionFromTokenizedMessage,
} from '../../utils';
import { writeGoogleSheet } from '../../google';
import { sheets_v4 } from 'googleapis';
import { CONFIG } from '../../config/config';
import {
  getMsgExplanation,
  getWrongAmountMessage,
  getOkMessage,
  getErrorMessage,
} from './messages';
import { Analytics } from '../../analytics';

type AddExpenseParams = {
  bot: TelegramBot;
  chatId: number;
  googleSheetClient: sheets_v4.Sheets;
  formattedDate: string;
  amount: number;
  description?: string;
  categoryName: string;
  subCategoryName?: string;
};
const addExpense = async ({
  googleSheetClient,
  formattedDate,
  amount,
  description,
  categoryName,
  subCategoryName,
}: AddExpenseParams): Promise<undefined | unknown> => {
  const expense = createExpenseRow({
    date: formattedDate,
    amount,
    categoryName,
    subCategoryName,
    description,
  });
  try {
    await writeGoogleSheet({
      client: googleSheetClient,
      sheetId: CONFIG.sheetId,
      tabName: CONFIG.tabName,
      range: CONFIG.range,
      data: expense,
    });
    return;
  } catch (e) {
    return e;
  }
};

type HandleGenericParams = {
  bot: TelegramBot;
  chatId: number;
  tokens: string[];
  googleSheetClient: sheets_v4.Sheets;
  formattedDate: string;
  amount: number;
  analytics: Analytics;
};
type HandleCategoryAndSubcategoryParams = HandleGenericParams & {
  allCategories: Category[];
};
type HandleSubcategoryParams = HandleGenericParams & {
  category: Category;
};
export const getCategoryAndSubcategoryHandler =
  ({
    bot,
    allCategories,
    chatId,
    tokens,
    googleSheetClient,
    formattedDate,
    amount,
    analytics,
  }: HandleCategoryAndSubcategoryParams) =>
  async (msg: TelegramBot.Message) => {
    const category = allCategories.find((c) => c.name === msg.text);
    if (!category) {
      bot.sendMessage(chatId, getErrorMessage());
      return;
    }

    const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

    // now, if there are subcategories, show them, otherwise add the expense
    if (category.subCategories.length === 0) {
      // the category doesn't have any subcategories, we can add the expense
      const err = await addExpense({
        bot,
        chatId,
        googleSheetClient,
        formattedDate,
        amount,
        description,
        categoryName: category.name,
      });
      bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());
      if (!err) {
        analytics.addTrackedExpense();
      }
      return;
    }

    // the category has subcategories, we need to show them
    bot.sendMessage(chatId, 'Scegli una sottocategoria', {
      reply_markup: {
        keyboard: category.subCategories.map((sc) => [{ text: sc.name }]),
        one_time_keyboard: true,
      },
    });
    bot.once(
      'message',
      getSubcategoryHandler({
        bot,
        category,
        chatId,
        tokens,
        googleSheetClient,
        formattedDate,
        amount,
        analytics,
      })
    );
    return;
  };

export const getSubcategoryHandler =
  ({
    bot,
    category,
    chatId,
    tokens,
    googleSheetClient,
    formattedDate,
    amount,
    analytics,
  }: HandleSubcategoryParams) =>
  async (msg: TelegramBot.Message) => {
    const subCategory = category.subCategories.find(
      (sc) => sc.name === msg.text
    );
    if (!subCategory) {
      // the user inserted a specific subcategory but we couldn't find it
      bot.sendMessage(chatId, getErrorMessage());
      return;
    }

    // we got everything, add the expense
    const description = getDescriptionFromTokenizedMessage(tokens);
    const err = await addExpense({
      bot,
      chatId,
      googleSheetClient,
      formattedDate,
      amount,
      description,
      categoryName: category.name,
      subCategoryName: subCategory.name,
    });
    bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());
    if (!err) {
      analytics.addTrackedExpense();
    }
    return;
  };

export const AddExpenseCommand: BotCommand = {
  pattern: /^aggiungi\s*((?!veloce).)*$/i,
  getHandler:
    (
      bot: TelegramBot,
      allCategories: Category[],
      analytics: Analytics,
      googleSheetClient: sheets_v4.Sheets
    ) =>
    async (msg: TelegramBot.Message) => {
      const { chatId, tokens, date } = fromMsg(msg);
      console.log(
        `AddExpenseCommand handler. Chat ${chatId}. Tokens ${tokens}. Date ${date}`
      );

      const categoriesFlat = allCategories.map((c) => c.name);

      // we need at least 'aggiungi <amount> <descrizione>|<categoria>'
      if (tokens.length < 3) {
        bot.sendMessage(chatId, getMsgExplanation());
        return;
      }

      let formattedDate = date.toLocaleDateString('it-IT');
      const amount = parseFloat(tokens[1]);
      if (isNaN(amount)) {
        bot.sendMessage(chatId, getWrongAmountMessage());
        return;
      }

      // ok we have the amount, now we need to understand category
      // and maybe the subcategory
      const secondLastToken = tokens[tokens.length - 2];
      const lastToken = tokens[tokens.length - 1];
      if (categoriesFlat.includes(lastToken)) {
        // last token is a category. if that category have no subcategories, we can add
        // the expense, otherwise we need to show the subcategories

        const category = allCategories.find((c) => c.name === lastToken)!;
        if (category.subCategories.length === 0) {
          // the category doesn't have any subcategories, we can add the expense

          // all the tokens except the first one (aggiungi), the amount and
          // the last one (category) are the description
          const description = getDescriptionFromTokenizedMessage(tokens);
          const err = await addExpense({
            bot,
            chatId,
            googleSheetClient,
            formattedDate,
            amount,
            description,
            categoryName: category.name,
          });
          bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());
          if (!err) {
            analytics.addTrackedExpense();
          }
          return;
        } else {
          // we have the category, but we need to understand the subcategory
          // show the subcategories and then add the expense
          const subCategories = category.subCategories.map((sc) => [
            { text: sc.name },
          ]);
          bot.sendMessage(chatId, 'Scegli una sottocategoria', {
            reply_markup: {
              keyboard: subCategories,
              one_time_keyboard: true,
            },
          });

          // we add another listener to get the subcategory
          // TODO: this is actually not so correct, if another message comes meanwhile, it screw this up :(
          // (maybe we can mitigate this with a check on the chatId, but not .once then)
          bot.once(
            'message',
            getSubcategoryHandler({
              bot,
              category,
              chatId,
              tokens,
              googleSheetClient,
              formattedDate,
              amount,
              analytics,
            })
          );
          return;
        }
      } else if (categoriesFlat.includes(secondLastToken)) {
        // second last token is a category, need to check if last token is a (correct) subcategory
        const category = allCategories.find((c) => c.name === secondLastToken)!;
        const subCategory = category.subCategories.find(
          (sc) => sc.name === lastToken
        );
        // TODO: it would be nice to have some kind of tolerance to typos
        if (!subCategory) {
          // last token is not a subcategory, send an error message
          bot.sendMessage(
            chatId,
            `Non sono riuscito ad individuare la categoria e sotto categoria, reinserisci la spesa`
          );
          return;
        }

        // we got everything, add the expense
        const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);
        const err = await addExpense({
          bot,
          chatId,
          googleSheetClient,
          formattedDate,
          amount,
          description,
          categoryName: category.name,
          subCategoryName: subCategory.name,
        });
        bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());
        if (!err) {
          analytics.addTrackedExpense();
        }
        return;
      } else {
        const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);
        // the user wants to add the expense, but he didn't specify the category and subcategory
        // we need to show the category list (and after the subcategories based on his response)
        bot.sendMessage(chatId, 'Scegli una categoria', {
          reply_markup: {
            keyboard: allCategories.map((c) => [{ text: c.name }]),
            one_time_keyboard: true,
          },
        });

        // we need to wait for both the category and the subcategory (if exists)
        // TODO: this is error prone too, another message could screw this up
        // (maybe we can mitigate this with a check on the chatId, but not .once then)
        bot.once(
          'message',
          getCategoryAndSubcategoryHandler({
            bot,
            allCategories,
            chatId,
            tokens,
            googleSheetClient,
            formattedDate,
            amount,
            analytics,
          })
        );
        return;
      }
    },
};
