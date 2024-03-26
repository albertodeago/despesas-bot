import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import { StartCommand } from './start';
import TelegramBot from 'node-telegram-bot-api';
import { getMockLogger } from '../../logger/mock';
import { getMockGoogleService } from '../../services/google/mock';

const spyRead = vi.fn(() => Promise.resolve()); // just need to resolve

const mockGoogleService = getMockGoogleService({
  // @ts-expect-error
  spyRead,
});

const bot = {
  sendMessage: vi.fn(),
};
const defaultMsg: TelegramBot.Message = {
  text: '/start sheet-id',
  chat: {
    id: 123,
    type: 'private',
  },
  date: new Date().getTime(),
  message_id: 987654321,
};
const mockConfig = {
  EXPENSES: {
    TAB_NAME: 'tab-name',
  },
};
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

describe('StartCommand', () => {
  let handler: ReturnType<typeof StartCommand.getHandler>;

  beforeEach(() => {
    handler = StartCommand.getHandler({
      // @ts-expect-error
      bot,
      googleService: mockGoogleService,
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
    expect(StartCommand.pattern.test('/start')).toBe(false);
    expect(StartCommand.pattern.test('/start sheet-id-123')).toBe(true);
    expect(
      StartCommand.pattern.test('/start vaffanculo questo non è un id')
    ).toBe(false);
  });

  it("should answer with an error message if he can't read from the provided sheet", async () => {
    spyRead.mockImplementationOnce(() => Promise.reject());
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(defaultMsg.chat.id);
    expect(calledWith[1]).toContain(
      'Non riesco a leggere il foglio di calcolo'
    );
  });

  it('should update the chat configuration if the chat is already in the configuration', async () => {
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
    expect(calledWith[0]).toEqual('123'); // chatId
    expect(mockChatsConfigUC.addChatToConfiguration).not.toHaveBeenCalled();
  });

  it('should add a new row in the chat configuration if the chat is not in the configuration (and answer with the welcome msg)', async () => {
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = mockChatsConfigUC.addChatToConfiguration.mock.calls[0];
    expect(calledWith[0]).toEqual({
      chatId: '123',
      spreadsheetId: 'sheet-id',
      isActive: true,
    });
    expect(mockChatsConfigUC.updateChatInConfiguration).not.toHaveBeenCalled();
  });
});
