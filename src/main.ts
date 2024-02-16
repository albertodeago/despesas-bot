import 'dotenv/config';
import { getGoogleSheetClient } from './google';
import { CategoriesCommand } from './commands/categories/categories';
import { getConfig } from './config/config';
import { getBot } from './telegram';
import { StartCommand } from './commands/start/start';
import { StopCommand } from './commands/stop/stop';
import { AddExpenseCommand } from './commands/expenses/add-expense';
import { AddExpenseQuickCommand } from './commands/expenses/add-expense-quick';
import { Analytics } from './analytics';
import { version } from '../package.json';
import { Categories } from './use-cases/categories';
import { ChatsConfiguration } from './use-cases/chats-configuration';

const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET;
const GOOGLE_SECRET_CLIENT_EMAIL = process.env.GOOGLE_SECRET_CLIENT_EMAIL;
const GOOGLE_SECRET_PRIVATE_KEY = (
  process.env.GOOGLE_SECRET_PRIVATE_KEY || ''
).replace(/\\n/g, '\n'); // https://stackoverflow.com/questions/74131595/error-error1e08010cdecoder-routinesunsupported-with-google-auth-library

const ENVIRONMENT: Environment =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

if (
  !TELEGRAM_SECRET ||
  !GOOGLE_SECRET_CLIENT_EMAIL ||
  !GOOGLE_SECRET_PRIVATE_KEY
) {
  throw new Error('Missing environment variables, please check the .env file');
}

/**
MANDATORY TO RELEASE
- TODO: /help per capire come funziona (anche come condividere il sheet al bot)
- TODO: dire a botfather cosa può fare e cambiare icona al bot
- TODO: test some actual failure (e.g. start with an invalid id - check others)
- TODO: review todos inside project

FUTURE:
- TODO: [FEATURE] how do we handle recurrent expenses?
  - TODO: [FEATURE] can I turn on some 'reminders' so that the bot help me track recurrent expenses (e.g. monthly bills) (activable in chats)
  - TODO: [FEATURE] add command to add recurrent expenses? (e.g. "aggiungi ricorrente 30 bolletta gas") -> but how do we let the user select when and how frequently?
- TODO: [FEATURE] recurrent message (weekly or monthly) for a report/summary? (activable in chats)
  - it would be pretty cool to send also a report/summary via some pie-charts
- TODO: [FEATURE] can we parse vocals and answer/handle that too?
- TODO: [FEATURE] typo tolerant?

OPTIONAL:
- [CODE_QUALITY] expose a fixture folder in each module with a mock version of the module?
- [FEATURE] function to add a categoriy / subcateogory? Do we want to add this kind of "admin" features?
- [FEATURE] alias /a for "aggiungi"?
- [FEATURE] alias /av for "aggiungi veloce"?
- [FEATURE] make answers rendere le risposte un po' varie (fatto, spesa aggiunta, ho aggiunto la spesa x, etc...)
- [MAINTENACE] better log management, add a logger with `.info` and `.debug` methods and add meaningful logs
- [MAINTENANCE] add an "error tracker" that sends error to my chat or something like that? At least to not be 100% blind
- [CODE_QUALITY] improve project structure, currently it's pretty messy, also, some stuff are classes, some are just functions, meh

Probably a big refactor would make things easier.
If we put just one listener for every message, in that listener we could:
- log request
- check if the msg is to be ignored
- get / refresh the cache for the categories for that chatId
- based on the message, "call" a command or something like that
*/

const main = async () => {
  const config = getConfig(ENVIRONMENT);

  const googleSheetClient = await getGoogleSheetClient({
    clientEmail: GOOGLE_SECRET_CLIENT_EMAIL,
    privateKey: GOOGLE_SECRET_PRIVATE_KEY,
  });

  const analytics = new Analytics(googleSheetClient, config, ENVIRONMENT);

  // TODO: create a UC also to write on google? this way we can just create one and pass down, avoiding the pass down the client everywhere
  const categoriesUC = new Categories(googleSheetClient, config);
  const chatsConfigUC = new ChatsConfiguration(googleSheetClient, config);

  const bot = await getBot(TELEGRAM_SECRET, ENVIRONMENT);
  const upAndRunningMsg = `Bot v${version} up and listening. Environment ${ENVIRONMENT}`;

  // On startup we want to inform the admin that the bot is up
  console.log(upAndRunningMsg);
  bot.sendMessage(config.DEPLOY_CHAT_ID, upAndRunningMsg);

  // TODO: do we want to attach a generic listener just to log incoming msg?
  bot.on('message', (msg) => {
    console.log(`Received message on chat ${msg.chat.id}: ${msg.text}`);
  });

  bot.onText(
    StartCommand.pattern,
    StartCommand.getHandler({ bot, googleSheetClient, config, chatsConfigUC })
  );

  bot.onText(
    StopCommand.pattern,
    StopCommand.getHandler({ bot, googleSheetClient, config, chatsConfigUC })
  );

  bot.onText(
    AddExpenseCommand.pattern,
    AddExpenseCommand.getHandler({
      bot,
      categoriesUC,
      analytics,
      googleSheetClient,
      config,
      chatsConfigUC,
    })
  );

  bot.onText(
    AddExpenseQuickCommand.pattern,
    AddExpenseQuickCommand.getHandler({
      bot,
      googleSheetClient,
      analytics,
      config,
      chatsConfigUC,
    })
  );

  bot.onText(
    CategoriesCommand.pattern,
    CategoriesCommand.getHandler({
      bot,
      categoriesUC,
      chatsConfigUC,
    })
  );
};
main();
