import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import { StopCommand } from './stop';
import TelegramBot from 'node-telegram-bot-api';

const mocks = vi.hoisted(() => {
  return {
    spyReadGoogleSheet: vi.fn(() => Promise.resolve()), // just need to resolve
    isChatInConfiguration: vi.fn(() => Promise.resolve(false)),
    updateChatInConfiguration: vi.fn((p1, p2, p3, p4) => Promise.resolve()),
    getChatsConfiguration: vi.fn((p1, p2, p3) =>
      Promise.resolve([
        {
          chatId: '012',
          spreadsheetId: 'sheet-0',
          isActive: true,
        },
        {
          chatId: '123',
          spreadsheetId: 'sheet-1',
          isActive: true,
        },
      ])
    ),
  };
});
vi.mock('../../google', () => ({
  readGoogleSheet: mocks.spyReadGoogleSheet,
}));
vi.mock('../../use-cases/chats-configuration', () => ({
  isChatInConfiguration: mocks.isChatInConfiguration,
  updateChatInConfiguration: mocks.updateChatInConfiguration,
  getChatsConfiguration: mocks.getChatsConfiguration,
}));

const bot = {
  sendMessage: vi.fn(),
};
const defaultMsg: TelegramBot.Message = {
  text: '/stop',
  chat: {
    id: 123,
    type: 'private',
  },
  date: new Date().getTime(),
  message_id: 987654321,
};
const mockConfig = {
  tabName: 'tab-name',
};
const mockGoogleSheetClient = {};

describe('StopCommand', () => {
  let handler: ReturnType<typeof StopCommand.getHandler>;

  beforeEach(() => {
    handler = StopCommand.getHandler({
      // @ts-expect-error
      bot,
      // @ts-expect-error
      googleSheetClient: mockGoogleSheetClient,
      // @ts-expect-error
      config: mockConfig,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should match the command regex', () => {
    expect(StopCommand.pattern.test('/stop')).toBe(true);
    expect(StopCommand.pattern.test('/stop string')).toBe(true);
  });

  it("should answer with an error message if he doesn't find the sheet in the config", async () => {
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(defaultMsg.chat.id);
    expect(calledWith[1]).toContain('Non risulta esserci');
  });

  it('should answer with an error message if he cannot read from the configuration', async () => {
    mocks.isChatInConfiguration.mockImplementationOnce(() => Promise.reject());
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(defaultMsg.chat.id);
    expect(calledWith[1]).toContain('Non risulta esserci');
  });

  it('should update the chat configuration setting the chat to inactive ', async () => {
    mocks.isChatInConfiguration.mockImplementationOnce(() =>
      Promise.resolve(true)
    );
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = mocks.updateChatInConfiguration.mock.calls[0];
    expect(calledWith[2]).toEqual('123');
    expect(calledWith[3]).toEqual({
      chatId: '123',
      spreadsheetId: 'sheet-1',
      isActive: false,
    });
  });
});
