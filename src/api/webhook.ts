import type { VercelRequest, VercelResponse } from '@vercel/node';
// import { getBot } from '../telegram/index.js';

const checkEnv = () => {
  const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET;
  const GOOGLE_SECRET_CLIENT_EMAIL = process.env.GOOGLE_SECRET_CLIENT_EMAIL;
  const GOOGLE_SECRET_PRIVATE_KEY = process.env.GOOGLE_SECRET_PRIVATE_KEY;

  if (
    !TELEGRAM_SECRET ||
    !GOOGLE_SECRET_CLIENT_EMAIL ||
    !GOOGLE_SECRET_PRIVATE_KEY
  ) {
    //   throw new Error('Missing environment variables, please check the .env file');
    return false;
  }
};
export default function (request: VercelRequest, response: VercelResponse) {
  const { name = 'World' } = request.query;

  if (!checkEnv()) {
    response.send('Missing environment variables, please check the .env file');
    return;
  }

  //   const bot = getBot(process.env.TELEGRAM_SECRET);

  response.send(`Hello ${name}!`);
}
