import TelegramBot from 'node-telegram-bot-api';
import { Category } from '../categories/fetch';
import { fromMsg } from '../../utils';
import { ExpenseRow, writeGoogleSheet } from '../../google';
import { sheets_v4 } from 'googleapis';
import { CONFIG } from '../../config/config';

const getMsgExplanation = () => `Per aggiungere una spesa, scrivere\n
aggiungi <importo> <descrizione> <categoria>? <sottocategoria>?\n\n
Se invece vuoi aggiungere velocemente una spesa non categorizzandola, scrivi\n
aggiungi veloce <importo> <descrizione>\n`;
const getWrongAmountMessage =
  () => `L'importo dev'essere un numero. Un esempio per inserire una spesa è:\n
aggiungi 7.50 aperitivo`;
const getOkMessage = () => `Fatto!`;
const getErrorMessage = (e?: unknown) => {
  const errMsg = e ? `\nErrore:\n${e}` : '';
  return `C\è stato un problema, reinserisci la spesa\n${errMsg}`;
};

type AddExpenseParams = {
  bot: TelegramBot;
  chatId: number;
  googleSheetClient: sheets_v4.Sheets;
  formattedDate: string;
  amount: number;
  description: string;
  categoryName: string;
  subCategoryName: string;
};
const addExpense = async ({
  bot,
  chatId,
  googleSheetClient,
  formattedDate,
  amount,
  description,
  categoryName,
  subCategoryName,
}: AddExpenseParams): Promise<undefined | unknown> => {
  const expense: [ExpenseRow] = [
    [formattedDate, amount, categoryName, subCategoryName, description],
  ];
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

export const AddExpenseCommand = {
  pattern: /^aggiungi/i,
  getHandler:
    (
      bot: TelegramBot,
      allCategories: Category[],
      googleSheetClient: sheets_v4.Sheets
    ) =>
    async (msg: TelegramBot.Message) => {
      const { chatId, tokens, date } = fromMsg(msg);
      console.log(
        `AddExpenseCommand handler. Chat ${chatId}. Tokens ${tokens}`
      );

      const categoriesFlat = allCategories.map((c) => c.name);

      // we need at least 'aggiungi <amount> <categoria>'
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
          const description = tokens.slice(2, tokens.length - 1).join(' ');
          const expense: [ExpenseRow] = [
            [formattedDate, amount, category.name, '', description],
          ];
          try {
            await writeGoogleSheet({
              client: googleSheetClient,
              sheetId: CONFIG.sheetId,
              tabName: CONFIG.tabName,
              range: CONFIG.range,
              data: expense,
            });
            bot.sendMessage(chatId, getOkMessage());
          } catch (e) {
            bot.sendMessage(chatId, getErrorMessage(e));
          }
          return;
        } else {
          // we need to show the subcategories and then add the expense
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
          // TODO: this is actually not so correct, if another message comes meanwhile, it screw this up :(  (maybe we can mitigate this with a check on the chatId, but not .once then)
          bot.once('message', async (msg) => {
            const subCategory = category.subCategories.find(
              (sc) => sc.name === msg.text
            );
            if (!subCategory) {
              // the user inserted a specific subcategory but we couldn't find it
              bot.sendMessage(
                chatId,
                'Cè stato un problema, reinserisci la spesa'
              );
              return;
            }

            // we got everything, add the expense
            const description = tokens.slice(2, tokens.length - 1).join(' ');
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
            bot.sendMessage(
              chatId,
              err ? getErrorMessage(err) : getOkMessage()
            );
            return;
          });
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
        const description = tokens.slice(2, tokens.length - 2).join(' ');
        const expense: [ExpenseRow] = [
          [formattedDate, amount, category.name, subCategory.name, description],
        ];
        try {
          await writeGoogleSheet({
            client: googleSheetClient,
            sheetId: CONFIG.sheetId,
            tabName: CONFIG.tabName,
            range: CONFIG.range,
            data: expense,
          });
          bot.sendMessage(chatId, getOkMessage());
          return;
        } catch (e) {
          bot.sendMessage(chatId, getErrorMessage(e));
          return;
        }
      } else {
        const description = tokens.slice(2, tokens.length).join(' ');
        // the user wants to add the expense, but he didn't specify the category and subcategory
        // we need to show the category list (and after the subcategories based on his response)
        bot.sendMessage(chatId, 'Scegli una categoria', {
          reply_markup: {
            keyboard: allCategories.map((c) => [{ text: c.name }]),
            one_time_keyboard: true,
          },
        });
        // TODO: this is error prone too, another message could screw this up (maybe we can mitigate this with a check on the chatId, but not .once then)
        bot.once('message', async (msg) => {
          const category = allCategories.find((c) => c.name === msg.text);
          if (!category) {
            bot.sendMessage(chatId, getErrorMessage());
            return;
          }

          // now, if there are subcategories, show them, otherwise add the expense

          if (category.subCategories.length === 0) {
            // the category doesn't have any subcategories, we can add the expense
            const expense: [ExpenseRow] = [
              [formattedDate, amount, category.name, '', description],
            ];
            try {
              await writeGoogleSheet({
                client: googleSheetClient,
                sheetId: CONFIG.sheetId,
                tabName: CONFIG.tabName,
                range: CONFIG.range,
                data: expense,
              });
              bot.sendMessage(chatId, getOkMessage());
              return;
            } catch (e) {
              bot.sendMessage(chatId, getErrorMessage(e));
              return;
            }
          }

          // the category has subcategories, we need to show them
          bot.sendMessage(chatId, 'Scegli una sottocategoria', {
            reply_markup: {
              keyboard: category.subCategories.map((sc) => [{ text: sc.name }]),
              one_time_keyboard: true,
            },
          });
          bot.once('message', async (msg) => {
            const subCategory = category.subCategories.find(
              (sc) => sc.name === msg.text
            );
            if (!subCategory) {
              bot.sendMessage(chatId, getErrorMessage());
              return;
            }

            // we got everything, add the expense
            const expense: [ExpenseRow] = [
              [
                formattedDate,
                amount,
                category.name,
                subCategory.name,
                description,
              ],
            ];
            try {
              await writeGoogleSheet({
                client: googleSheetClient,
                sheetId: CONFIG.sheetId,
                tabName: CONFIG.tabName,
                range: CONFIG.range,
                data: expense,
              });
              bot.sendMessage(chatId, getOkMessage());
              return;
            } catch (e) {
              bot.sendMessage(chatId, getErrorMessage(e));
              return;
            }
          });
        });
      }
    },
};
