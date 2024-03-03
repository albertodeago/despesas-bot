import TelegramBot from 'node-telegram-bot-api';
import {
  fromMsg,
  createExpenseRow,
  getDescriptionFromTokenizedMessage,
  formatDate,
} from '../../utils';
import { appendGoogleSheet } from '../../google';
import { sheets_v4 } from 'googleapis';
import {
  getMsgExplanation,
  getWrongAmountMessage,
  getOkMessage,
  getErrorMessage,
} from './messages';
import { Analytics } from '../../analytics';

import type { ChatsConfigurationUseCase } from '../../use-cases/chats-configuration';
import type { CONFIG_TYPE } from '../../config/config';
import type { Categories } from '../../use-cases/categories';
import type { Category } from '../../use-cases/categories';
import { Logger } from '../../logger';

const GENERIC_ERROR_MSG = 'Si è verificato un errore, riprovare più tardi.';

type AddExpenseParams = {
  bot: TelegramBot;
  chatId: number;
  googleSheetClient: sheets_v4.Sheets;
  formattedDate: string;
  amount: number;
  description?: string;
  categoryName: string;
  subCategoryName?: string;
  config: CONFIG_TYPE;
  spreadSheetId: SheetId;
};
const addExpense = async ({
  googleSheetClient,
  formattedDate,
  amount,
  description,
  categoryName,
  subCategoryName,
  config,
  spreadSheetId,
}: AddExpenseParams): Promise<undefined | unknown> => {
  const expense = createExpenseRow({
    date: formattedDate,
    amount,
    categoryName,
    subCategoryName,
    description,
  });
  try {
    await appendGoogleSheet({
      client: googleSheetClient,
      sheetId: spreadSheetId,
      tabName: config.tabName,
      range: config.range,
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
  config: CONFIG_TYPE;
  spreadSheetId: SheetId;
};
type HandleCategoryAndSubcategoryParams = HandleGenericParams & {
  allCategories: Category[];
};
type HandleSubcategoryParams = HandleGenericParams & {
  category: Category;
  description: string;
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
    config,
    spreadSheetId,
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
        config,
        spreadSheetId,
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
        description,
        googleSheetClient,
        formattedDate,
        amount,
        analytics,
        config,
        spreadSheetId,
      })
    );
    return;
  };

export const getSubcategoryHandler =
  ({
    bot,
    category,
    chatId,
    description,
    googleSheetClient,
    formattedDate,
    amount,
    analytics,
    config,
    spreadSheetId,
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
    const err = await addExpense({
      bot,
      chatId,
      googleSheetClient,
      formattedDate,
      amount,
      description,
      categoryName: category.name,
      subCategoryName: subCategory.name,
      config,
      spreadSheetId,
    });
    bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());
    if (!err) {
      analytics.addTrackedExpense();
    }
    return;
  };

type AddExpenseCommandHandlerProps = {
  bot: TelegramBot;
  categoriesUC: Categories;
  analytics: Analytics;
  googleSheetClient: sheets_v4.Sheets;
  config: CONFIG_TYPE;
  chatsConfigUC: ChatsConfigurationUseCase;
  logger: Logger;
};
export const AddExpenseCommand: BotCommand<AddExpenseCommandHandlerProps> = {
  pattern: /^aggiungi\s*((?!veloce).)*$/i,
  getHandler:
    ({
      bot,
      categoriesUC,
      analytics,
      googleSheetClient,
      config,
      chatsConfigUC,
      logger,
    }) =>
    async (msg: TelegramBot.Message) => {
      const { chatId, strChatId, tokens, date } = fromMsg(msg);
      logger.info(`AddExpenseCommand handler. Tokens ${tokens}`, strChatId);

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

        const categoriesFlat = allCategories.map((c) => c.name);

        // we need at least 'aggiungi <amount> <descrizione>|<categoria>'
        if (tokens.length < 3) {
          bot.sendMessage(chatId, getMsgExplanation());
          return;
        }

        let formattedDate = formatDate(date);
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
              config,
              spreadSheetId,
            });
            bot.sendMessage(
              chatId,
              err ? getErrorMessage(err) : getOkMessage()
            );
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

            const description = getDescriptionFromTokenizedMessage(tokens);

            // we add another listener to get the subcategory
            // TODO: this is actually not so correct, if another message comes meanwhile, it screw this up :(
            // (maybe we can mitigate this with a check on the chatId, but not .once then)
            bot.once(
              'message',
              getSubcategoryHandler({
                bot,
                category,
                chatId,
                description,
                tokens,
                googleSheetClient,
                formattedDate,
                amount,
                analytics,
                config,
                spreadSheetId,
              })
            );
            return;
          }
        } else if (categoriesFlat.includes(secondLastToken)) {
          // second last token is a category, need to check if last token is a (correct) subcategory
          const category = allCategories.find(
            (c) => c.name === secondLastToken
          )!;
          const subCategory = category.subCategories.find(
            (sc) => sc.name === lastToken
          );
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
            config,
            spreadSheetId,
          });
          bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());
          if (!err) {
            analytics.addTrackedExpense();
          }
          return;
        } else {
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
              config,
              spreadSheetId,
            })
          );
          return;
        }
      } catch (e) {
        const err = new Error(
          `Error while handling the add-expense command: ${e}`
        );
        logger.sendError(err, strChatId);

        bot.sendMessage(chatId, GENERIC_ERROR_MSG);
      }
    },
};
