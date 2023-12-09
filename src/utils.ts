import TelegramBot from 'node-telegram-bot-api';

export const fromMsg = (msg: TelegramBot.Message) => {
  const tokens = msg.text?.split(' ') ?? [];

  return {
    chatId: msg.chat.id,
    messageText: msg.text,
    date: new Date(msg.date * 1000),
    tokens,
  };
};
