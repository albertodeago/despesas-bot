import { describe, expect, vi } from 'vitest';
import { StartCommand } from './start';
import TelegramBot from 'node-telegram-bot-api';

const defaultMsg: TelegramBot.Message = {
  text: '/start',
  chat: {
    id: 123,
    type: 'private',
  },
  date: new Date().getTime(),
  message_id: 987654321,
};

describe('StartCommand', (it) => {
  it('should match /start', () => {
    expect(StartCommand.pattern.test('/start')).toBe(true);
  });
  it('should answer with a welcome message', () => {
    const bot = {
      sendMessage: vi.fn(),
    };
    const handler = StartCommand.getHandler(bot as any);
    handler(defaultMsg);

    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      'Benvenuto nel tuo bot di gestione delle spese!'
    );
    // TODO: should answer with a list of available commands
  });
});
