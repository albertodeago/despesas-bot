import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import { StartCommand } from './start';
import TelegramBot from 'node-telegram-bot-api';

const mocks = vi.hoisted(() => {
  return {
    spyReadGoogleSheet: vi.fn(() => Promise.resolve()), // just need to resolve
    isChatInConfiguration: vi.fn(() => Promise.resolve(false)),
    updateChatInConfiguration: vi.fn((p1, p2, p3) => Promise.resolve()),
    addChatToConfiguration: vi.fn((p1, p2, p3) => Promise.resolve()),
  };
});
vi.mock('../../google', () => ({
  readGoogleSheet: mocks.spyReadGoogleSheet,
}));
vi.mock('../../use-cases/chats-configuration', () => ({
  isChatInConfiguration: mocks.isChatInConfiguration,
  updateChatInConfiguration: mocks.updateChatInConfiguration,
  addChatToConfiguration: mocks.addChatToConfiguration,
}));

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
  tabName: 'tab-name',
};
const mockGoogleSheetClient = {};

describe('StartCommand', () => {
  let handler: ReturnType<typeof StartCommand.getHandler>;

  beforeEach(() => {
    handler = StartCommand.getHandler({
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
    expect(StartCommand.pattern.test('/start')).toBe(false);
    expect(StartCommand.pattern.test('/start sheet-id-123')).toBe(true);
    expect(
      StartCommand.pattern.test('/start vaffanculo questo non è un id')
    ).toBe(false);
  });

  it("should answer with an error message if he can't read from the provided sheet", async () => {
    mocks.spyReadGoogleSheet.mockImplementationOnce(() => Promise.reject());
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
    mocks.isChatInConfiguration.mockImplementationOnce(() =>
      Promise.resolve(true)
    );
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = mocks.updateChatInConfiguration.mock.calls[0];
    expect(calledWith[2]).toEqual('123'); // chatId
    expect(mocks.addChatToConfiguration).not.toHaveBeenCalled();
  });

  it('should add a new row in the chat configuration if the chat is not in the configuration (and answer with the welcome msg)', async () => {
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = mocks.addChatToConfiguration.mock.calls[0];
    expect(calledWith[2]).toEqual({
      chatId: '123',
      spreadsheetId: 'sheet-id',
      isActive: true,
    });
    expect(mocks.updateChatInConfiguration).not.toHaveBeenCalled();
  });
});
