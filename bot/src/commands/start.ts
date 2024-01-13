import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../utils';

export const StartCommand = {
  pattern: /\/start/,
  getHandler: (bot: TelegramBot) => (msg: TelegramBot.Message) => {
    const { chatId } = fromMsg(msg);
    console.log(`StartCommand handler. Chat ${chatId}`);

    bot.sendMessage(chatId, 'Benvenuto nel tuo bot di gestione delle spese!');
    // TODO: lista comandi disponibili
  },
};
