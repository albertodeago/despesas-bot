import TelegramBot from 'node-telegram-bot-api';

export const getBot = (secret: string): TelegramBot => {
  const bot = new TelegramBot(secret, {
    // polling: true
    // webHook: {
    //   port: 3000,
    // },
  });

  // setup webhook -> we can't do it here, we need to do manually after the deploy to tell telegram where to send the messages
  //   const url = 'https://8f1c-79-41-228-175.ngrok-free.app';
  //   bot.setWebHook(`${url}/bot${secret}`);

  return bot;
};
