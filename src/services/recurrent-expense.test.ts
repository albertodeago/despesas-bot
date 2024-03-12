import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RecurrentExpense,
  initRecurrentExpenseService,
} from './recurrent-expense';
import { sheets_v4 } from 'googleapis';
import { getMockLogger } from '../logger/mock';

const mocks = vi.hoisted(() => ({
  readGoogleSheet: vi.fn(async () => [
    [
      'category',
      'subCategory',
      'message',
      'amount',
      'frequency',
      'lastAddedDate',
    ],
    [
      'category',
      'subCategory',
      'recurrent expense message 1',
      '10',
      'daily',
      '',
    ],
    [
      'category',
      'subCategory',
      'recurrent expense message 2',
      '20',
      'wrong',
      '',
    ],
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
  ]),
  updateGoogleSheet: vi.fn(),
}));
vi.mock('../google', () => ({
  readGoogleSheet: mocks.readGoogleSheet,
  updateGoogleSheet: mocks.updateGoogleSheet,
}));

const mockConfig = {
  RECURRENT_EXPENSES: {
    TAB_NAME: 'tab',
    RANGE: 'range',
  },
  ADMINISTRATION_CHAT_ID: 'admin-chat-id',
};
const mockClient = {} as sheets_v4.Sheets;
const mockLogger = getMockLogger();
const mockBot = { sendMessage: vi.fn() } as any;

describe('RecurrentExpenseService', () => {
  const recurrentExpenseService = initRecurrentExpenseService({
    client: mockClient,
    config: mockConfig,
    logger: mockLogger,
    bot: mockBot,
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return an empty array if there are no recurrent expenses', async () => {
      mocks.readGoogleSheet.mockImplementationOnce(() => Promise.resolve([]));
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
      const result = await recurrentExpenseService.get(
        'chat-123',
        'spreadsheetId'
      );
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
      expect(mocks.updateGoogleSheet).toHaveBeenCalledWith({
        client: mockClient,
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
