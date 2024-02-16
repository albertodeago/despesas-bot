import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../../utils';
import { CONFIG_TYPE } from '../../config/config';
import { sheets_v4 } from 'googleapis';
import {
  getChatsConfiguration,
  isChatInConfiguration,
  updateChatInConfiguration,
} from '../../use-cases/chats-configuration';

const STOP_MSG = `Scollegato, non traccerò più spese.

Se vuoi re-iniziare a tracciarle, utilizza di nuovo il comando /start <sheet-id>
`;

const NO_SHEET_FOUND = `Non risulta esserci un foglio di calcolo associato a questa chat.`;

type StopCommandHandlerProps = {
  bot: TelegramBot;
  googleSheetClient: sheets_v4.Sheets;
  config: CONFIG_TYPE;
};
export const StopCommand: BotCommand<StopCommandHandlerProps> = {
  pattern: /\/stop/,
  getHandler({ bot, googleSheetClient, config }) {
    return async (msg: TelegramBot.Message) => {
      const { chatId, strChatId, tokens } = fromMsg(msg);
      console.log(`StopCommand handler. Chat ${strChatId}. Tokens ${tokens}`);

      try {
        // check if we have the chatId in the ChatConfig
        const isInConfig = await isChatInConfiguration(
          googleSheetClient,
          config,
          strChatId
        );

        if (isInConfig) {
          // get the chatConfiguration and then update the value setting it to not active
          const chats = await getChatsConfiguration(googleSheetClient, config);
          const chatConfig = chats?.find((c) => c.chatId === strChatId);
          await updateChatInConfiguration(
            googleSheetClient,
            config,
            `${chatId}`,
            {
              ...chatConfig!,
              isActive: false,
            }
          );

          bot.sendMessage(chatId, STOP_MSG, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, NO_SHEET_FOUND, { parse_mode: 'Markdown' });
        }

        return;
      } catch (e) {
        console.error(`Error stopping the bot for ${strChatId}. Error: ${e}`);
        bot.sendMessage(chatId, NO_SHEET_FOUND);
        return;
      }
    };
  },
};
