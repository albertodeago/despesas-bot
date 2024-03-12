import { vi, it, describe, expect, afterEach } from 'vitest';
import { getMockLogger } from '../logger/mock';
import { initRecurrentExpenses } from './expenses';
import TelegramBot from 'node-telegram-bot-api';
import { RecurrentExpense } from '../services/recurrent-expense';

const setIntervalMock = vi.fn();
vi.stubGlobal('setInterval', setIntervalMock);

const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot;
const loggerMock = getMockLogger();
const chatsConfigUCMock = {
  isChatInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(false)),
  updateChatInConfiguration: vi.fn((p1: ChatId, p2: ChatConfig) =>
    Promise.resolve(true)
  ),
  get: vi.fn(() =>
    Promise.resolve([
      {
        chatId: '123',
        spreadsheetId: 'sheet-1',
        isActive: true,
      },
      {
        chatId: '-321',
        spreadsheetId: 'sheet-2',
        isActive: true,
      },
      {
        chatId: '456',
        spreadsheetId: 'sheet-3',
        isActive: false,
      },
    ])
  ),
  addChatToConfiguration: vi.fn((p1: ChatConfig) => Promise.resolve(true)),
  isChatActiveInConfiguration: vi.fn((p1: ChatId) => Promise.resolve(true)),
  getSpreadsheetIdFromChat: vi.fn((p1: ChatId) => Promise.resolve('sheet-id')),
};
const recurrentExpenseServiceMock = {
  get: vi.fn((chatId) =>
    Promise.resolve(
      chatId !== '-321'
        ? []
        : ([
            {
              index: 1,
              category: 'cat1',
              subCategory: 'subcat1',
              message: 'msg1',
              amount: 10,
              frequency: 'daily',
              lastAddedDate: new Date(
                new Date().setDate(new Date().getDate() - 2)
              ),
            },
            {
              index: 2,
              category: 'cat2',
              subCategory: 'subcat2',
              message: 'msg2',
              amount: 20,
              frequency: 'monthly',
              lastAddedDate: new Date(),
            },
            {
              index: 3,
              category: 'cat3',
              subCategory: 'subcat3',
              message: 'msg3',
              amount: 30,
              frequency: 'daily',
              lastAddedDate: new Date(),
            },
          ] as RecurrentExpense[])
    )
  ),
  updateRecurrentExpense: vi.fn(() => Promise.resolve()),
};

describe('RecurrentExpenses', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should schedule a cron function every x time', () => {
      const recurrentExpenseHandler = initRecurrentExpenses({
        logger: loggerMock,
        chatsConfigUC: chatsConfigUCMock,
        bot: mockBot,
        recurrentExpenseService: recurrentExpenseServiceMock,
      });
      recurrentExpenseHandler.start();

      expect(setIntervalMock).toHaveBeenCalledWith(
        recurrentExpenseHandler.check,
        1000 * 60 * 60
      );
    });
  });

  describe('check', () => {
    const recurrentExpenseHandler = initRecurrentExpenses({
      logger: loggerMock,
      chatsConfigUC: chatsConfigUCMock,
      bot: mockBot,
      recurrentExpenseService: recurrentExpenseServiceMock,
    });

    it('should check all the recurrent expense, update the due ones and send the message for them', async () => {
      await recurrentExpenseHandler.check();
      expect(chatsConfigUCMock.get).toHaveBeenCalled();
      expect(recurrentExpenseServiceMock.get).toHaveBeenCalled();
      expect(
        recurrentExpenseServiceMock.updateRecurrentExpense
      ).toHaveBeenCalledWith('sheet-2', {
        index: 1,
        category: 'cat1',
        subCategory: 'subcat1',
        message: 'msg1',
        amount: 10,
        frequency: 'daily',
        lastAddedDate: expect.any(Date),
      });
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '-321',
        expect.any(String)
      );
    });

    it('should not check the recurrent expenses for inactive chats', async () => {
      await recurrentExpenseHandler.check();
      expect(chatsConfigUCMock.get).toHaveBeenCalled();
      const calls = recurrentExpenseServiceMock.get.mock.calls;
      expect(calls[0][0]).toBe('123');
      expect(calls[1][0]).toBe('-321');
      expect(calls).toHaveLength(2);
    });

    it('should not check the recurrent expenses for inactive chats', async () => {
      await recurrentExpenseHandler.check();
      expect(chatsConfigUCMock.get).toHaveBeenCalled();
      const calls = recurrentExpenseServiceMock.get.mock.calls;
      expect(calls[0][0]).toBe('123');
      expect(calls[1][0]).toBe('-321');
      expect(calls).toHaveLength(2);
    });
  });
});
