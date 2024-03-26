import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RecurrentExpense,
  initRecurrentExpenseService,
} from './expense';
import { getMockLogger } from '../../logger/mock';
import { getMockGoogleService } from '../google/mock';
import { formatDate } from '../../utils';

const spyRead = vi.fn(async () => [
  [
    'category',
    'subCategory',
    'message',
    'amount',
    'frequency',
    'lastAddedDate',
  ],
  ['category', 'subCategory', 'recurrent expense message 1', '10', 'settimanale', ''],
  ['category', 'subCategory', 'recurrent expense message 2', '20', 'wrong', ''],
  [
    'category',
    'subCategory',
    'recurrent expense message 3',
    '30',
    'mensile',
    '',
  ],
  [
    'category',
    'subCategory',
    'recurrent expense message 4',
    '40',
    'bimestrale',
    '',
  ],
]);
const spyUpdate = vi.fn();
const spyAppend = vi.fn();

const mockConfig = {
  RECURRENT_EXPENSES: {
    TAB_NAME: 'tab',
    RANGE: 'range',
  },
  ADMINISTRATION_CHAT_ID: 'admin-chat-id',
  EXPENSES: {
    TAB_NAME: 'expense-tab',
    RANGE: 'expense-range',
  },
};
const mockLogger = getMockLogger();
const mockBot = { sendMessage: vi.fn() } as any;
const mockGoogleService = getMockGoogleService({
  spyRead,
  spyUpdate,
  spyAppend,
});

const newExpense = {
  index: 2,
  category: 'category',
  subCategory: 'subCategory',
  message: 'recurrent expense message 1',
  amount: 10,
  frequency: 'settimanale',
  lastAddedDate: new Date('2024-01-01T00:00:00.000Z'),
} as RecurrentExpense;

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
          frequency: 'settimanale',
          lastAddedDate: expect.any(Date),
        },
        {
          index: 2,
          category: 'category',
          subCategory: 'subCategory',
          message: 'recurrent expense message 3',
          amount: 30,
          frequency: 'mensile',
          lastAddedDate: expect.any(Date),
        },
        {
          index: 3,
          category: 'category',
          subCategory: 'subCategory',
          message: 'recurrent expense message 4',
          amount: 40,
          frequency: 'bimestrale',
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
            'settimanale',
            newExpense.lastAddedDate,
          ],
        ],
      });
    });
  });

  describe('addExpense', () => {
    it('should add the expense in the provided spreadsheet', async () => {
      const todayFormatted = formatDate(new Date());
      await recurrentExpenseService.addExpense(newExpense, 'spreadsheetId');
      expect(mockGoogleService.appendGoogleSheet).toHaveBeenCalledWith({
        sheetId: 'spreadsheetId',
        tabName: 'expense-tab',
        range: 'expense-range',
        data: [
          [
            todayFormatted,
            newExpense.amount,
            newExpense.category,
            newExpense.subCategory,
            newExpense.message,
          ],
        ],
      });
    });
  });
});
