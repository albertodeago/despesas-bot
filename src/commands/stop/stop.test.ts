import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import { StopCommand } from './stop';
import TelegramBot from 'node-telegram-bot-api';
import { getMockLogger } from '../../logger/mock';

const mocks = vi.hoisted(() => ({
  spyReadGoogleSheet: vi.fn(() => Promise.resolve()), // just need to resolve
}));
vi.mock('../../google', () => ({
  readGoogleSheet: mocks.spyReadGoogleSheet,
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
const mockChatsConfigUC = {
  isChatInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(false)),
  updateChatInConfiguration: vi.fn((p1: ChatId, p2: ChatConfig) =>
    Promise.resolve(true)
  ),
  get: vi.fn(() =>
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
  addChatToConfiguration: vi.fn((p1: ChatConfig) => Promise.resolve(true)),
  isChatActiveInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(true)),
  getSpreadsheetIdFromChat: vi.fn((p1: ChatId) =>
    Promise.resolve('spread-123')
  ),
};
const mockLogger = getMockLogger();

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
      chatsConfigUC: mockChatsConfigUC,
      logger: mockLogger,
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
    mockChatsConfigUC.isChatInConfiguration.mockImplementationOnce(() =>
      Promise.reject()
    );
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
    mockChatsConfigUC.isChatInConfiguration.mockImplementationOnce(() =>
      Promise.resolve(true)
    );
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith =
      mockChatsConfigUC.updateChatInConfiguration.mock.calls[0];
    expect(calledWith[0]).toEqual('123');
    expect(calledWith[1]).toEqual({
      chatId: '123',
      spreadsheetId: 'sheet-1',
      isActive: false,
    });
  });
});
