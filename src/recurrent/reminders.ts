import TelegramBot from 'node-telegram-bot-api';

import type { Logger } from '../logger';
import type { ChatsConfigurationUseCase } from '../use-cases/chats-configuration';
import type {
  Reminder,
  ReminderService,
} from '../services/recurrent/reminder';
import type { Analytics } from '../analytics';

type InitRemindersParams = {
  logger: Logger;
  bot: TelegramBot;
  chatsConfigUC: ChatsConfigurationUseCase;
  reminderService: ReminderService;
  analytics: Analytics;
};

const CHECK_INTERVAL = 1000 * 60 * 0.5; // 60 minutes

export const initReminders = ({
  logger,
  bot,
  chatsConfigUC,
  reminderService,
  analytics,
}: InitRemindersParams) => {
  let interval: NodeJS.Timeout | null = null;

  // Check reminders
  const check = async () => {
    // 1. read the chatConfiguration
    // 2. for each *active* chat, read the google sheet "promemoria" tab
    // 3. for each reminder, check if it's due
    // 4. if it is, send a message to the user
    // 5. update the "last-added-date" column in the "promemoria" tab
    logger.debug('Checking reminders', 'NO_CHAT');

    try {
      const activeChats = (await chatsConfigUC.get()).filter(
        (chat) => chat.isActive
      );
      for (const chat of activeChats) {
        const strChatId = `${chat.chatId}`;
        logger.debug(
          `Checking reminders for chat ${chat.chatId}`,
          strChatId
        );

        const reminders = await reminderService.get(
          chat.chatId,
          chat.spreadsheetId
        );
console.log(reminders)
        for (const reminder of reminders) {
          // Check if the reminder is due
          if (isReminderDue(reminder)) {
            logger.info(
              `Reminder ${reminder.index} ${reminder.message} ${reminder.lastAddedDate} is due (frequency ${reminder.frequency})`,
              'NO_CHAT'
            );

            analytics.addTrackedReminder();

            // update the "last-added-date" column in the "promemoria" tab
            await reminderService.updateReminder(
              chat.spreadsheetId,
              {
                ...reminder,
                lastAddedDate: new Date(),
              }
            );

            const message = createMessage(reminder);
            bot.sendMessage(chat.chatId, message);
          } else {
            logger.debug(
              `Checked ${reminder.index} - not due ${reminder.frequency} - ${reminder.lastAddedDate}`,
              'NO_CHAT'
            );
          }
        }
      }
    } catch (e) {
      const err = new Error(`Error while checking reminders: ${e}`);
      logger.sendError(err, 'NO_CHAT');
    }
  };

  // Check reminders every x time
  const start = () => {
    logger.info('Starting reminders', 'NO_CHAT');
    interval = setInterval(check, CHECK_INTERVAL);
  };

  return {
    check, // mainly returned for testing purposes
    start,
  };
};

const isReminderDue = (reminder: Reminder) => {
  const now = Date.now();
  const lastAddedTs = reminder.lastAddedDate.getTime();
  const frequency = reminder.frequency;

  // Check if the reminder is due
  switch (frequency) {
    case 'settimanale':
      return now > lastAddedTs + 1000 * 60 * 60 * 24 * 7;
      case 'mensile':
      console.log(now, "\n",lastAddedTs)
      return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30;
    case 'bimestrale':
      return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30 * 2;
    case 'trimestrale':
      return now > lastAddedTs + 1000 * 60 * 60 * 24 * 30 * 3;
    default:
      return false;
  }
};

const createMessage = (reminder: Reminder) => {
  return `Promemoria: ${reminder.message}`;
};
