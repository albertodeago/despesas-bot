import TelegramBot from 'node-telegram-bot-api';
import {
  fromMsg,
  createExpenseRow,
  getDescriptionFromTokenizedMessage,
  formatDate,
} from '../../utils';
import { CONFIG_TYPE, UNCATEGORIZED_CATEGORY } from '../../config/config';
import {
  getWrongAmountMessageQuick,
  getOkMessage,
  getErrorMessage,
  genericErrorMsg,
} from './messages';
import { Analytics } from '../../analytics';

import type { ChatsConfigurationUseCase } from '../../use-cases/chats-configuration';
import type { Logger } from '../../logger';
import type { GoogleService } from '../../services/google';

type AddExpenseQuickParams = {
  bot: TelegramBot;
  chatId: number;
  googleService: GoogleService;
  formattedDate: string;
  amount: number;
  description?: string;
  config: CONFIG_TYPE;
  spreadSheetId: SheetId;
};
const addExpense = async ({
  googleService,
  formattedDate,
  amount,
  description,
  config,
  spreadSheetId,
}: AddExpenseQuickParams): Promise<undefined | unknown> => {
  const expense = createExpenseRow({
    date: formattedDate,
    amount,
    categoryName: UNCATEGORIZED_CATEGORY,
    subCategoryName: UNCATEGORIZED_CATEGORY,
    description,
  });
  try {
    await googleService.appendGoogleSheet({
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

type AddExpenseQuickCommandHandlerProps = {
  bot: TelegramBot;
  googleService: GoogleService;
  analytics: Analytics;
  config: CONFIG_TYPE;
  chatsConfigUC: ChatsConfigurationUseCase;
  logger: Logger;
};
export const AddExpenseQuickCommand: BotCommand<AddExpenseQuickCommandHandlerProps> =
  {
    pattern: /^aggiungi veloce/i,
    getHandler:
      ({ bot, googleService, analytics, config, chatsConfigUC, logger }) =>
      async (msg: TelegramBot.Message) => {
        const { chatId, strChatId, tokens, date } = fromMsg(msg);
        logger.info(
          `AddExpenseQuickCommand handler. Tokens ${tokens}`,
          strChatId
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

          let formattedDate = formatDate(date);
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
            googleService,
            formattedDate,
            amount,
            description,
            config,
            spreadSheetId,
          });
          bot.sendMessage(chatId, err ? getErrorMessage(err) : getOkMessage());

          if (!err) {
            analytics.addTrackedExpense();
          }

          return;
        } catch (e) {
          const err = new Error(
            `Error while handling the add-expense-quick command ${e}`
          );
          logger.sendError(err, strChatId);

          bot.sendMessage(chatId, genericErrorMsg);
        }
      },
  };
