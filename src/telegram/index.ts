import TelegramBot from 'node-telegram-bot-api';

export const getBot = (secret: string): TelegramBot => {
  const bot = new TelegramBot(secret, {
    // polling: true
    webHook: {
      port: 3000,
    },
  });

  // setup webhook
  const url = 'https://72dd-79-41-228-175.ngrok-free.app';
  bot.setWebHook(`${url}/bot${secret}`);

  return bot;
};
