import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RecurrentExpense,
  initRecurrentExpenseService,
} from './recurrent-expense';
import { getMockLogger } from '../logger/mock';
import { getMockGoogleService } from './google/mock';

const spyRead = vi.fn(async () => [
  [
    'category',
    'subCategory',
    'message',
    'amount',
    'frequency',
    'lastAddedDate',
  ],
  ['category', 'subCategory', 'recurrent expense message 1', '10', 'daily', ''],
  ['category', 'subCategory', 'recurrent expense message 2', '20', 'wrong', ''],
  [
    'category',
    'subCategory',
    'recurrent expense message 3',
    '30',
    'monthly',
    '',
  ],
  [
    'category',
    'subCategory',
    'recurrent expense message 4',
    '40',
    'weekly',
    '',
  ],
]);
const spyUpdate = vi.fn();

const mockConfig = {
  RECURRENT_EXPENSES: {
    TAB_NAME: 'tab',
    RANGE: 'range',
  },
  ADMINISTRATION_CHAT_ID: 'admin-chat-id',
};
const mockLogger = getMockLogger();
const mockBot = { sendMessage: vi.fn() } as any;
const mockGoogleService = getMockGoogleService({
  spyRead,
  spyUpdate,
});

describe('RecurrentExpenseService', () => {
  const recurrentExpenseService = initRecurrentExpenseService({
    googleService: mockGoogleService,
    config: mockConfig,
    logger: mockLogger,
    bot: mockBot,
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return an empty array if there are no recurrent expenses', async () => {
      spyRead.mockImplementationOnce(() => Promise.resolve([]));
      const result = await recurrentExpenseService.get(
        'chatId',
        'spreadsheetId'
      );
      expect(result).toEqual([]);
    });

    it('should return an array of recurrent expenses (filtering invalid entries)', async () => {
      const result = await recurrentExpenseService.get(
        'chatId',
        'spreadsheetId'
      );
      expect(result).toEqual([
        {
          index: 0,
          category: 'category',
          subCategory: 'subCategory',
          message: 'recurrent expense message 1',
          amount: 10,
          frequency: 'daily',
          lastAddedDate: expect.any(Date),
        },
        {
          index: 2,
          category: 'category',
          subCategory: 'subCategory',
          message: 'recurrent expense message 3',
          amount: 30,
          frequency: 'monthly',
          lastAddedDate: expect.any(Date),
        },
        {
          index: 3,
          category: 'category',
          subCategory: 'subCategory',
          message: 'recurrent expense message 4',
          amount: 40,
          frequency: 'weekly',
          lastAddedDate: expect.any(Date),
        },
      ]);
    });

    it('should alert the user if an entry have something invalid', async () => {
      await recurrentExpenseService.get('chat-123', 'spreadsheetId');
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        'chat-123',
        expect.stringContaining('Frequency is required')
      );
    });
  });

  describe('updateRecurrentExpense', () => {
    it('should update the last added date for the expense', async () => {
      const newExpense = {
        index: 2,
        category: 'category',
        subCategory: 'subCategory',
        message: 'recurrent expense message 1',
        amount: 10,
        frequency: 'daily',
        lastAddedDate: new Date(),
      } as RecurrentExpense;
      await recurrentExpenseService.updateRecurrentExpense(
        'spreadsheetId',
        newExpense
      );
      expect(spyUpdate).toHaveBeenCalledWith({
        sheetId: 'spreadsheetId',
        tabName: 'tab',
        range: 'A4:F4',
        data: [
          [
            'category',
            'subCategory',
            'recurrent expense message 1',
            10,
            'daily',
            newExpense.lastAddedDate,
          ],
        ],
      });
    });
  });
});
