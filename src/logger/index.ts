import TelegramBot from 'node-telegram-bot-api';
import type { CONFIG_TYPE } from '../config/config';

// NO_CHAT means that we are logging something that is happening outside of a chat (e.g. startup message)
type ChatIdentifier = ChatId | 'NO_CHAT';

export type Logger = ReturnType<typeof initLogger>;

type InitLoggerParams = {
  bot: TelegramBot;
  config: CONFIG_TYPE;
};
export const initLogger = ({ bot, config }: InitLoggerParams) => {
  const info = (msg: string, chatId: ChatId) => {
    console.info(`${new Date()} - chatId:${chatId} - msg:${msg}`);
  };

  const debug = (msg: string, chatId: ChatId) => {
    console.debug(`${new Date()} - chatId:${chatId} - msg:${msg}`);
  };

  const error = (err: Error, chatId: ChatId) => {
    console.error(
      `${new Date()} - chatId:${chatId} - msg:${err.message} - trace:${
        err.stack
      }`
    );
  };

  const sendInfo = (msg: string, chatId: ChatId) => {
    info(msg, chatId);
    bot.sendMessage(config.ADMINISTRATION_CHAT_ID, msg);
  };

  const sendError = (err: Error, chatId: ChatId) => {
    error(err, chatId);
    bot.sendMessage(config.ADMINISTRATION_CHAT_ID, `Error: ${err.message}`);
  };

  return {
    info,
    debug,
    error,
    sendInfo,
    sendError,
  };
};
