import { readGoogleSheet, updateGoogleSheet } from '../google';

import type { sheets_v4 } from 'googleapis';
import type { CONFIG_TYPE } from '../config/config';
import type { Logger } from '../logger';
import TelegramBot from 'node-telegram-bot-api';

type RecurrentExpenseFrequency = 'daily' | 'weekly' | 'monthly';
export type RecurrentExpense = {
  index: number; // this is the row number in the google sheet, we use it as an identifier
  category: string;
  subCategory?: string;
  message?: string;
  amount: number;
  frequency: RecurrentExpenseFrequency;
  lastAddedDate: Date;
};

export type RecurrentExpenseService = ReturnType<
  typeof initRecurrentExpenseService
>;

type RecurrentExpenseServiceParams = {
  client: sheets_v4.Sheets;
  config: Pick<CONFIG_TYPE, 'RECURRENT_EXPENSES' | 'ADMINISTRATION_CHAT_ID'>;
  logger: Logger;
  bot: TelegramBot;
};
export const initRecurrentExpenseService = ({
  client,
  config,
  logger,
  bot,
}: RecurrentExpenseServiceParams) => {
  const onError = (e: Error) => {
    logger.error(e, 'NO_CHAT');
    bot.sendMessage(
      config.ADMINISTRATION_CHAT_ID,
      `C'è stato un errore nel leggere le spese ricorrenti: ${e}`
    );
  };

  const get = async (chatId: ChatId, spreadsheetId: SheetId) => {
    try {
      const recurrentExpenses = await readGoogleSheet({
        client,
        sheetId: spreadsheetId,
        tabName: config.RECURRENT_EXPENSES.TAB_NAME,
        range: config.RECURRENT_EXPENSES.RANGE,
      });

      if (recurrentExpenses && recurrentExpenses.length > 0) {
        // first element is the header, we can skip it
        recurrentExpenses.shift();

        // FIXME: Considering that we can have recurrent daily minimum, we can strip the time from the date (just keep yyyy-mm-dd)
        // This way it's readable for the user and we can compare it easily, we lose precision but who cares for this feature

        // Remove every elements that has an invalid frequency
        // and if something is not ok, we can track the error AND alert the user!
        const validRecurrentExpenses: RecurrentExpense[] = recurrentExpenses
          // we first map and then filter to have the indexes of the valid expenses that we will use as ID when updating
          .map((expense, index) => {
            const errorMsg = checkRecurrentExpense(expense as ExpenseRow);
            // TODO: should we move all the error handling in the domain? Service should just do requests I guess
            if (errorMsg) {
              logger.error(
                new Error(`Invalid recurrent expense: ${errorMsg}`),
                'NO_CHAT'
              );
              bot.sendMessage(
                chatId,
                `Ho provato ad aggiungere una spesa ricorrente ma c'è stato un errore: Invalid recurrent expense: ${errorMsg}\nDovresti sistermarla nel tuo spreadsheet!`
              );
              // return an invalid entry, it will be filtered out
              return {
                index,
                category: '',
                subCategory: '',
                message: '',
                amount: 0,
                frequency: 'invalid' as RecurrentExpenseFrequency,
                lastAddedDate: new Date(),
              };
            }

            return {
              index,
              category: expense[0],
              subCategory: expense[1],
              message: expense[2],
              amount: parseInt(expense[3]),
              frequency: expense[4] as RecurrentExpenseFrequency,
              lastAddedDate: getDateWithFallback(expense[5]),
            };
          })
          .filter((expense) =>
            ['daily', 'weekly', 'monthly'].includes(expense.frequency)
          );

        return validRecurrentExpenses;
      }
    } catch (e) {
      onError(new Error(`Error while reading recurrent expenses: ${e}`));
    }

    return [];
  };

  const updateRecurrentExpense = async (
    sheetId: SheetId,
    expense: RecurrentExpense
  ) => {
    try {
      const expenseIndex = expense.index + 2; // +2 because the first row is the header and google sheets is 1-based
      const range = `A${expenseIndex}:F${expenseIndex}`;

      await updateGoogleSheet({
        client,
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
          `Error while updating last added date of a recurrent expense: ${e}`
        )
      );
    }
  };

  return {
    get,
    updateRecurrentExpense,
  };
};

type ExpenseRow = [string, string, string, string, string, string];
const checkRecurrentExpense = (expenseRow: ExpenseRow): string | undefined => {
  let errorMsg: string | undefined = undefined;

  const [category, subCategory, message, amount, frequency, lastAddedDate] =
    expenseRow;
  if (!category) {
    errorMsg = 'Category is required';
  } else if (!amount) {
    errorMsg = 'Amount is required';
  } else if (
    !frequency ||
    ['daily', 'weekly', 'monthly'].includes(frequency) === false
  ) {
    errorMsg = 'Frequency is required and must be daily, weekly or monthly';
  }

  return errorMsg;
};

// Last added date is either what we find, or we set a default value (1 year ago, just to be sure the bot will consider it due)
const getDateWithFallback = (date: string): Date => {
  if (date) {
    return new Date(date);
  } else {
    const lastAddedDate = new Date();
    lastAddedDate.setFullYear(lastAddedDate.getFullYear() - 1);
    return lastAddedDate;
  }
};
