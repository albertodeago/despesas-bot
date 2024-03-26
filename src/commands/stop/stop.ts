import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../../utils';
import type { ChatsConfigurationUseCase } from '../../use-cases/chats-configuration';
import { Logger } from '../../logger';
import { CONFIG_TYPE } from '../../config/config';

const STOP_MSG = `Scollegato, non traccerò più spese.

Se vuoi re-iniziare a tracciarle, utilizza di nuovo il comando /start <sheet-id>
`;

const NO_SHEET_FOUND = `Non risulta esserci un foglio di calcolo associato a questa chat.`;

type StopCommandHandlerProps = {
  bot: TelegramBot;
  chatsConfigUC: ChatsConfigurationUseCase;
  logger: Logger;
  config: Pick<CONFIG_TYPE, "ADMINISTRATION_CHAT_ID">;
};
export const StopCommand: BotCommand<StopCommandHandlerProps> = {
  pattern: /\/stop/,
  getHandler({ bot, chatsConfigUC, logger, config }) {
    return async (msg: TelegramBot.Message) => {
      const { chatId, strChatId, tokens } = fromMsg(msg);
      logger.info(`StopCommand handler. Tokens ${tokens}`, strChatId);

      try {
        // check if we have the chatId in the ChatConfig
        const isInConfig = await chatsConfigUC.isChatInConfiguration(strChatId);

        if (isInConfig) {
          // get the chatConfiguration and then update the value setting it to not active
          const chats = await chatsConfigUC.get();
          const chatConfig = chats?.find((c) => c.chatId === strChatId);
          await chatsConfigUC.updateChatInConfiguration(`${chatId}`, {
            ...chatConfig!,
            isActive: false,
          });

          bot.sendMessage(chatId, STOP_MSG, { parse_mode: 'Markdown' });
          bot.sendMessage(config.ADMINISTRATION_CHAT_ID, `Bot stopped for chat ${strChatId}`);
        } else {
          bot.sendMessage(chatId, NO_SHEET_FOUND, { parse_mode: 'Markdown' });
        }

        return;
      } catch (e) {
        const err = new Error(`Error while handling the stop command: ${e}`);
        logger.sendError(err, strChatId);

        bot.sendMessage(chatId, NO_SHEET_FOUND);
        return;
      }
    };
  },
};
