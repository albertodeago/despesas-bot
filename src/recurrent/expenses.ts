import { sheets_v4 } from 'googleapis';
import { readGoogleSheet, updateGoogleSheet } from '../google';
import { formatDate } from '../utils';
import type { Logger } from '../logger';
import type { ChatsConfigurationUseCase } from '../use-cases/chats-configuration';

// TODO: actually make this longer!
const CHECK_INTERVAL = 1000 * 5; // 5 seconds

type InitRecurrentExpensesType = {
  logger: Logger;
  chatsConfigUC: ChatsConfigurationUseCase;
  client: sheets_v4.Sheets;
};
export const initRecurrentExpenses = ({
  logger,
  chatsConfigUC,
  client,
}: InitRecurrentExpensesType) => {
  const start = () => {
    // 1. run a cron function every x time
    // 2. read the chatConfiguration
    // 3. for each *active* chat, read the google sheet "spese-ricorrenti" tab
    // 4. for each expense, check if the expense is due
    // 5. if the expense is due, add the expense to the "spese" tab
    // 6. update the "last-added-date" column in the "spese-ricorrenti" tab
    // 7. send a message to the chat

    // TODO: use something better than `setInterval`
    setInterval(async () => {
      logger.debug('Checking recurrent expenses', 'NO_CHAT');

      const activeChats = (await chatsConfigUC.get()).filter(
        (chat) => chat.isActive
      );
      for (const chat of activeChats) {
        logger.debug(
          `Checking recurrent expenses for chat ${chat.chatId}`,
          '' + chat.chatId
        );

        const recurrentExpenses = await getRecurrentExpenses(
          client,
          chat.spreadsheetId
        );
        console.log({ recurrentExpenses });
        logger.debug(
          `Valid recurrent expenses: ${recurrentExpenses[0].lastAddedDate.toLocaleDateString(
            'it-IT'
          )}`,
          'NO_CHAT'
        );

        for (const expense of recurrentExpenses) {
          // TODO: what about time zones?
          const now = Date.now();
          const lastAddedTs = expense.lastAddedDate.getTime();
          const frequency = expense.frequency;

          // mock the frequency at each 1 minute
          // check if the expense is due
          if (now > lastAddedTs + 1000 * 60) {
            logger.debug(`Expense ${expense.index} is due`, 'NO_CHAT');

            // add the expense to the "spese" tab
            // TODO

            // update the "last-added-date" column in the "spese-ricorrenti" tab
            await updateRecurrentExpense(client, chat.spreadsheetId, {
              ...expense,
              lastAddedDate: new Date(),
            });
            console.log('Spesa ricorrente aggiornata');
          }

          // TODO: save dates in ISO format
        }
      }
    }, CHECK_INTERVAL);

    logger.info('Starting recurrent expenses', 'NO_CHAT');
  };

  return {
    start,
  };
};

type RecurrentExpenseFrequency = 'daily' | 'weekly' | 'monthly';
type RecurrentExpense = {
  index: number; // this is the row number in the google sheet, we use it as an identifier
  category: string;
  subCategory?: string;
  message?: string;
  amount: number;
  frequency: RecurrentExpenseFrequency;
  lastAddedDate: Date;
};

// TODO: move this in a separate module / use-case?
async function getRecurrentExpenses(
  client: sheets_v4.Sheets,
  sheetId: SheetId
) {
  const recurrentExpenses = await readGoogleSheet({
    client,
    sheetId,
    tabName: 'Spese Ricorrenti', // TODO: move this in a config
    range: 'A1:G50', // TODO: move this in a config + document this limit!
  });

  if (recurrentExpenses && recurrentExpenses.length > 0) {
    // first element is the header, we can skip it
    recurrentExpenses.shift();

    // remove every elements that has an invalid frequency TODO: actually we should do a proper validation here
    // and if something is not ok, we can track the error AND alert the user!
    const validRecurrentExpenses: RecurrentExpense[] = recurrentExpenses
      // we first map and then filter to have the indexes of the valid expenses that we will use as ID when updating
      .map((expense, index) => {
        // Last added date is either what we find, or we set a default value (e.g. 2 months ago)
        let lastAddedDate: Date;
        if (!expense[5]) {
          // TODO: what about time zones?
          lastAddedDate = new Date();
          lastAddedDate.setMonth(lastAddedDate.getMonth() - 2);
        } else {
          // TODO: what about time zones?
          lastAddedDate = new Date(expense[5]);
        }

        return {
          index,
          category: expense[0],
          subCategory: expense[1],
          message: expense[2],
          amount: parseInt(expense[3]),
          frequency: expense[4] as RecurrentExpenseFrequency,
          lastAddedDate,
        };
      })
      .filter((expense) =>
        ['daily', 'weekly', 'monthly'].includes(expense.frequency)
      );

    return validRecurrentExpenses;
  }

  return [];
}

async function updateRecurrentExpense(
  client: sheets_v4.Sheets,
  sheetId: SheetId,
  expense: RecurrentExpense
) {
  const expenseIndex = expense.index + 2; // +2 because the first row is the header and google sheets is 1-based
  await updateGoogleSheet({
    client,
    sheetId,
    tabName: 'Spese Ricorrenti', // TODO: move this in a config
    range: `A${expenseIndex}:F${expenseIndex}`,
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
}
