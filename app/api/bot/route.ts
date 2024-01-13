import { getBot } from './telegram';

export const dynamic = 'force-dynamic';

/**
 * EXAMPLE OF RECEIVED MESSAGE INSIDE THE BODY REQUEST
Message {
  message_id: 291,
  from: {
    id: 53084797,
    is_bot: false,
    first_name: 'Alberto',
    username: 'albertodeago',
    language_code: 'it'
  },
  chat: {
    id: 53084797,
    first_name: 'Alberto',
    username: 'albertodeago',
    type: 'private'
  },
  date: 1705157434,
  text: 'A'
} {
  message_id: 291,
  from: {
    id: 53084797,
    is_bot: false,
    first_name: 'Alberto',
    username: 'albertodeago',
    language_code: 'it'
  },
  chat: {
    id: 53084797,
    first_name: 'Alberto',
    username: 'albertodeago',
    type: 'private'
  },
  date: 1705157434,
  text: 'A'
}
 */
export async function POST(request: Request) {
  const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET;
  console.log('post received', TELEGRAM_SECRET);
  const body = await request.json();
  const msg = body.message;
  console.log('Message', msg, msg);

  const bot = getBot(TELEGRAM_SECRET!);

  bot.sendMessage(msg.chat.id, 'Hello from the POST API ' + msg.text);

  // notify Telegram that the answer was provided
  return new Response('OK', { status: 200 });
}
