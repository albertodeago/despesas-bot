import TelegramBot from 'node-telegram-bot-api';

export const getBot = async (secret: string): TelegramBot => {
  const bot = new TelegramBot(secret, {
    // polling: true
    webHook: {
      port: 3000,
    },
  });

  // setup webhook
  const url = process.env.WEBHOOK_URL;
  const res = await bot.setWebHook(`${url}/bot${secret}`);

  console.log('Webhook setup result: ', res);

  return bot;
};
