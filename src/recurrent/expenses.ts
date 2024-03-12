import TelegramBot from 'node-telegram-bot-api';
import { Logger } from '../logger';
import { ChatsConfigurationUseCase } from '../use-cases/chats-configuration';
import type {
  RecurrentExpense,
  RecurrentExpenseService,
} from '../services/recurrent-expense';

type InitRecurrentExpensesParams = {
  logger: Logger;
  bot: TelegramBot;
  chatsConfigUC: ChatsConfigurationUseCase;
  recurrentExpenseService: RecurrentExpenseService;
};

const CHECK_INTERVAL = 1000 * 60 * 60; // 60 minutes

export const initRecurrentExpenses = ({
  logger,
  bot,
  chatsConfigUC,
  recurrentExpenseService,
}: InitRecurrentExpensesParams) => {
  let interval: NodeJS.Timeout | null = null;

  // Check recurrent expenses
  const check = async () => {
    // 2. read the chatConfiguration
    // 3. for each *active* chat, read the google sheet "spese-ricorrenti" tab
    // 4. for each expense, check if the expense is due
    // 5. if the expense is due, add the expense to the "spese" tab
    // 6. update the "last-added-date" column in the "spese-ricorrenti" tab
    // 7. send a message to the chat
    logger.debug('Checking recurrent expenses', 'NO_CHAT');

    try {
      const activeChats = (await chatsConfigUC.get()).filter(
        (chat) => chat.isActive
      );
      for (const chat of activeChats) {
        const strChatId = `${chat.chatId}`;
        logger.debug(
          `Checking recurrent expenses for chat ${chat.chatId}`,
          strChatId
        );

        const recurrentExpenses = await recurrentExpenseService.get(
          chat.chatId,
          chat.spreadsheetId
        );

        for (const expense of recurrentExpenses) {
          // Check if the expense is due
          if (isRecurrentExpenseDue(expense)) {
            logger.info(
              `Expense ${expense.index} ${expense.category} ${expense.message} ${expense.lastAddedDate} is due (frequency ${expense.frequency})`,
              'NO_CHAT'
            );

            // add the expense to the "spese" tab
            // TODO: ExpenseService.addExpense(expense, chat.spreadsheetId); or something like this? to add the expense

            // update the "last-added-date" column in the "spese-ricorrenti" tab
            await recurrentExpenseService.updateRecurrentExpense(
              chat.spreadsheetId,
              {
                ...expense,
                lastAddedDate: new Date(),
              }
            );

            const message = createMessage(expense);
            bot.sendMessage(chat.chatId, message);
          }
        }
      }
    } catch (e) {
      const err = new Error(`Error while checking recurrent expenses: ${e}`);
      logger.sendError(err, 'NO_CHAT');
    }
  };

  // Check recurrent expenses every x time
  const start = () => {
    logger.info('Starting recurrent expenses', 'NO_CHAT');
    interval = setInterval(check, CHECK_INTERVAL);
  };

  return {
    check, // mainly returned for testing purposes
    start,
  };
};

const isRecurrentExpenseDue = (expense: RecurrentExpense) => {
  const now = Date.now();
  const lastAddedTs = expense.lastAddedDate.getTime();
  const frequency = expense.frequency;

  // Check if the expense is due
  switch (frequency) {
    case 'daily':
      return now > lastAddedTs + 1000 * 60 * 60 * 24;
    case 'weekly':
      return now > lastAddedTs + 1000 * 60 * 60 * 24 * 7;
    case 'monthly':
      return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30;
    default:
      return false;
  }
};

const createMessage = (expense: RecurrentExpense) => {
  const subCategory = expense.subCategory ? ` - ${expense.subCategory}` : '';
  return `Spesa ricorrente aggiunta: ${expense.category}${subCategory} - ${expense.amount}€`;
};
