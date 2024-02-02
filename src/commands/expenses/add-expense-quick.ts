import TelegramBot from 'node-telegram-bot-api';
import {
  fromMsg,
  createExpenseRow,
  getDescriptionFromTokenizedMessage,
} from '../../utils';
import { writeGoogleSheet } from '../../google';
import { sheets_v4 } from 'googleapis';
import { CONFIG_TYPE, UNCATEGORIZED_CATEGORY } from '../../config/config';
import {
  getWrongAmountMessageQuick,
  getOkMessage,
  getErrorMessage,
} from './messages';
import { Analytics } from '../../analytics';

type AddExpenseQuickParams = {
  bot: TelegramBot;
  chatId: number;
  googleSheetClient: sheets_v4.Sheets;
  formattedDate: string;
  amount: number;
  description?: string;
  config: CONFIG_TYPE;
};
const addExpense = async ({
  googleSheetClient,
  formattedDate,
  amount,
  description,
  config,
}: AddExpenseQuickParams): Promise<undefined | unknown> => {
  const expense = createExpenseRow({
    date: formattedDate,
    amount,
    categoryName: UNCATEGORIZED_CATEGORY,
    subCategoryName: UNCATEGORIZED_CATEGORY,
    description,
  });
  try {
    await writeGoogleSheet({
      client: googleSheetClient,
      sheetId: config.sheetId,
      tabName: config.tabName,
      range: config.range,
      data: expense,
    });
    return;
  } catch (e) {
    return e;
  }
};

type AddExpenseQuickCommandHandlerProps = {
  bot: TelegramBot;
  googleSheetClient: sheets_v4.Sheets;
  analytics: Analytics;
  config: CONFIG_TYPE;
};
export const AddExpenseQuickCommand: BotCommand<AddExpenseQuickCommandHandlerProps> =
  {
    pattern: /^aggiungi veloce/i,
    getHandler:
      ({ bot, googleSheetClient, analytics, config }) =>
      async (msg: TelegramBot.Message) => {
        const { chatId, tokens, date } = fromMsg(msg);
        console.log(
          `AddExpenseQuickCommand handler. Chat ${chatId}. Tokens ${tokens}. Date ${date}`
        );

        let formattedDate = date.toLocaleDateString('it-IT');
        const amount = parseFloat(tokens[2]);
        if (isNaN(amount)) {
          bot.sendMessage(chatId, getWrongAmountMessageQuick());
          return;
        }

        const description =
          tokens.length > 3
            ? getDescriptionFromTokenizedMessage(tokens, 3, 0)
            : undefined;

        const err = await addExpense({
          bot,
          chatId,
          googleSheetClient,
          formattedDate,
          amount,
          description,
          config,
        });
        bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());

        analytics.addTrackedExpense();

        return;
      },
  };
