import TelegramBot from 'node-telegram-bot-api';

const isDev = process.env.NODE_ENV === 'development';

export const getBot = (secret: string): TelegramBot => {
  const bot = new TelegramBot(secret, {
    // polling: true
    webHook: {
      port: isDev ? 3000 : 443,
    },
  });

  // setup webhook
  console.log(`Node env: ${process.env.NODE_ENV}`);
  const url = isDev
    ? 'https://19be-79-41-228-175.ngrok-free.app'
    : process.env.VERCEL_URL;
  bot.setWebHook(`${url}/bot${secret}`);

  return bot;
};
