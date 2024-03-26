import 'dotenv/config';
import { version } from '../package.json';
import { getGoogleSheetClient, initGoogleService } from './services/google';
import { getBot } from './telegram';
import { getConfig } from './config/config';
import { initAnalytics } from './analytics';

import { initCategoriesUseCase } from './use-cases/categories';
import { initChatsConfigurationUseCase } from './use-cases/chats-configuration';

import { HelpCommand } from './commands/help/help';
import { StartCommand } from './commands/start/start';
import { StopCommand } from './commands/stop/stop';
import { CategoriesCommand } from './commands/categories/categories';
import { AddExpenseCommand } from './commands/expenses/add-expense';
import { AddExpenseQuickCommand } from './commands/expenses/add-expense-quick';
import { initLogger } from './logger';
import { initRecurrentExpenses } from './recurrent/expenses';
import { initRecurrentExpenseService } from './services/recurrent/expense';
import { initReminders } from './recurrent/reminders';
import { initReminderService } from './services/recurrent/reminder';

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
- TODO: test some actual failure (e.g. start with an invalid id - check others)
- TODO: polish the spreadsheet (e.g. automatic graph, automatic color cells not categorized, format dates)

FUTURE:
- TODO: [FEATURE] add command to add recurrent expenses? (e.g. "ricorrente mensile 30 bolletta gas <categoria> <sottocategoria>")
- TODO: [FEATURE] add command to add reminders? (e.g. "promemoria settimanale bolletta gas")
  - TODO: do we want to let the user filter times when the bot checks for recurrent/reminders? (this would be a column in the sheet)
- TODO: [FEATURE] recurrent message (weekly or monthly) for a report/summary?
  - TODO: [FEATURE] it would be pretty cool to send also a report/summary via some pie-charts
- TODO: [FEATURE] can we parse vocals and answer/handle that too? (check wit.ai https://www.google.com/search?q=wit%20speech%20to%20text&sourceid=chrome&ie=UTF-8)
- TODO: [FEATURE] typo tolerant?

OPTIONAL:
- [CODE_QUALITY] expose a fixture/mock folder/file in each module with a mock version of the module?
- [FEATURE] function to add a category / subcateogory? Do we want to add this kind of "admin" features? (not sure if they are useful, ppl should just edit the spreadsheet manually)
- [FEATURE] alias /a for "aggiungi"?
- [FEATURE] alias /av for "aggiungi veloce"?
- [FEATURE] make answers various (e.g. "fatto", "spesa aggiunta", "ho aggiunto la spesa x", etc...)
- [CODE_QUALITY] improve project structure, currently it's pretty messy
  - we should have a "services" folder and "use-cases/domains" folder, services can only be used by use-cases
- [CODE_QUALITY] Add biome for linting and formatting (with PR check, and maybe pre-hook commit)

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

  const googleService = initGoogleService(googleSheetClient);

  const bot = await getBot(TELEGRAM_SECRET, ENVIRONMENT);
  const upAndRunningMsg = `Bot v${version} up and listening. Environment ${ENVIRONMENT}`;

  const logger = initLogger({
    bot,
    config,
    level: ENVIRONMENT === 'development' ? 2 : 1,
  });
  const analytics = initAnalytics({ googleService, config, logger });

  const recurrentExpenseService = initRecurrentExpenseService({
    googleService,
    config,
    logger,
    bot,
  });
  const reminderService = initReminderService({
    googleService,
    config,
    logger,
    bot,
  });

  const categoriesUC = initCategoriesUseCase({ config, logger, googleService });
  const chatsConfigUC = initChatsConfigurationUseCase({
    googleService,
    config,
    logger,
  });

  // On startup we want to inform the admin that the bot is up
  logger.sendInfo(upAndRunningMsg, 'NO_CHAT');

  bot.on('message', (msg): void => {
    logger.info(`Received message: ${msg.text}`, `${msg.chat.id}`);
  });

  bot.onText(HelpCommand.pattern, HelpCommand.getHandler({ bot, logger }));

  bot.onText(
    StartCommand.pattern,
    StartCommand.getHandler({
      bot,
      googleService,
      config,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    StopCommand.pattern,
    StopCommand.getHandler({
      bot,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    AddExpenseCommand.pattern,
    AddExpenseCommand.getHandler({
      bot,
      categoriesUC,
      analytics,
      googleService,
      config,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    AddExpenseQuickCommand.pattern,
    AddExpenseQuickCommand.getHandler({
      bot,
      googleService,
      analytics,
      config,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    CategoriesCommand.pattern,
    CategoriesCommand.getHandler({
      bot,
      categoriesUC,
      chatsConfigUC,
      logger,
    })
  );

  const recurrentExpenseHandler = initRecurrentExpenses({
    logger,
    chatsConfigUC,
    recurrentExpenseService,
    analytics,
    bot,
  });
  await recurrentExpenseHandler.check();
  recurrentExpenseHandler.start();

  const reminderHandler = initReminders({
    logger,
    chatsConfigUC,
    reminderService,
    analytics,
    bot,
  });
  await reminderHandler.check();
  reminderHandler.start();
};
main();
