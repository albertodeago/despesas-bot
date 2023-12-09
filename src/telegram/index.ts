import TelegramBot from 'node-telegram-bot-api';

export const getBot = (secret: string): TelegramBot => {
  return new TelegramBot(secret, { polling: true });
};
