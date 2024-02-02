import { describe, expect, vi, it, afterEach, beforeEach } from 'vitest';
import {
  AddExpenseCommand,
  getCategoryAndSubcategoryHandler,
  getSubcategoryHandler,
} from './add-expense';
import TelegramBot from 'node-telegram-bot-api';

// TODO: in this file we probably should mock the sheetId, tabName, range, etc...
// ^ is the above message still valid?

const mocks = vi.hoisted(() => {
  return {
    spyWriteGoogleSheet: vi.fn(() => Promise.resolve()),
  };
});
vi.mock('../../google', () => ({
  writeGoogleSheet: mocks.spyWriteGoogleSheet,
}));

const mockConfig = {
  sheetId: 'sheet-id',
  tabName: 'tab-name',
  range: 'A:Z',
};

const categories = [
  {
    name: 'Category_1',
    subCategories: [{ name: 'Subcategory_1' }, { name: 'Subcategory_2' }],
  },
  {
    name: 'Category_2',
    subCategories: [{ name: 'Subcategory_3' }, { name: 'Subcategory_4' }],
  },
  {
    name: 'Category_3',
    subCategories: [],
  },
];
const bot = {
  sendMessage: vi.fn(),
  once: vi.fn(),
};
const mockGoogleSheetClient = {};
const defaultMsg: TelegramBot.Message = {
  text: 'aggiungi 20 descrizione Category_1 Subcategory_1',
  chat: {
    id: 123,
    type: 'private',
  },
  date: 1702637184, // telegram date is a bit weird, it's a timestamp / 1000
  message_id: 987654321,
};
const mockAnalytics = {
  addTrackedExpense: vi.fn(),
};

describe('AddExpenseCommand', () => {
  let handler: (msg: TelegramBot.Message) => void;

  beforeEach(() => {
    handler = AddExpenseCommand.getHandler({
      // @ts-expect-error
      bot,
      allCategories: categories,
      // @ts-expect-error
      analytics: mockAnalytics,
      // @ts-expect-error
      googleSheetClient: mockGoogleSheetClient,
      // @ts-expect-error
      config: mockConfig,
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should match "aggiungis*((?!veloce).)*$"', () => {
    expect(AddExpenseCommand.pattern.test('aggiungi')).toBe(true);
    expect(AddExpenseCommand.pattern.test('aggiungi ')).toBe(true);
    expect(AddExpenseCommand.pattern.test('aggiung')).toBe(false);
    expect(AddExpenseCommand.pattern.test('aggiungi 10')).toBe(true);
    expect(AddExpenseCommand.pattern.test('aggiungi veloce')).toBe(false);
    expect(AddExpenseCommand.pattern.test('aggiungi vel')).toBe(true);
  });

  it("should send a explanation message if it doesn't have the necessary info to answer", () => {
    handler({ ...defaultMsg, text: 'aggiungi' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Per aggiungere una spesa, scrivere');
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  it('should send a explanation message if the amount is not a number', () => {
    handler({ ...defaultMsg, text: 'aggiungi merda in casa' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain("L'importo dev'essere un numero");
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  it('should add the expense if the message finish with a category with no subcategories', async () => {
    handler({ ...defaultMsg, text: 'aggiungi 20 descrizione Category_3' });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:Z',
      data: [['15/12/2023', 20, 'Category_3', '', 'descrizione']],
    });
    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
    expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
  });

  it("should ask for the subcategory if the message doesn't finish with a category with no subcategories", () => {
    handler({ ...defaultMsg, text: 'aggiungi 20 descrizione Category_1' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Scegli una sottocategoria');

    // we also set a once listener after this
    expect(bot.once).toHaveBeenCalled(); // tested with getSubcategoryHandler
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  it('should send an error message if the second last token is a category but the last one is not a subcategory', () => {
    handler({
      ...defaultMsg,
      text: 'aggiungi 20 descrizione Category_1 merda',
    });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain(
      'Non sono riuscito ad individuare la categoria e sotto categoria, reinserisci la spesa'
    );
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  it('should add the expense if the message finish with a category and subcategory', async () => {
    handler(defaultMsg);

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:Z',
      data: [['15/12/2023', 20, 'Category_1', 'Subcategory_1', 'descrizione']],
    });
    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
    expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
  });

  it("should add the expense also if the message doesn't have a description", async () => {
    handler({
      ...defaultMsg,
      text: 'aggiungi 20 Category_1 Subcategory_1',
    });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:Z',
      data: [['15/12/2023', 20, 'Category_1', 'Subcategory_1', '']],
    });
    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
    expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
  });

  it("should ask to select a category if the message doesn't provide one", () => {
    handler({
      ...defaultMsg,
      text: 'aggiungi 20 descrizione del cazzo ma senza una categoria',
    });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Scegli una categoria');
    expect(bot.once).toHaveBeenCalled(); // tested with getCategoryAndSubcategoryHandler
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  describe('getCategoryAndSubcategoryHandler', () => {
    const getHandler = () =>
      getCategoryAndSubcategoryHandler({
        // @ts-expect-error
        bot,
        // @ts-expect-error
        googleSheetClient: mockGoogleSheetClient,
        allCategories: categories,
        chatId: 123,
        tokens: ['aggiungi', '20', 'descrizione', 'multi', 'token'],
        formattedDate: '15/12/2023',
        amount: 50,
        // @ts-expect-error
        analytics: mockAnalytics,
        // @ts-expect-error
        config: mockConfig,
      });

    it("should send an error message if the category doesn't exist", async () => {
      const categoryHandler = getHandler();
      await categoryHandler({ ...defaultMsg, text: 'not-existing' });

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        'Cè stato un problema, reinserisci la spesa\n'
      );
      expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
    });

    it("should insert the expense if the selected category doesn't have subcategories", async () => {
      const categoryHandler = getHandler();
      await categoryHandler({ ...defaultMsg, text: 'Category_3' });

      expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
        client: mockGoogleSheetClient,
        sheetId: 'sheet-id',
        tabName: 'tab-name',
        range: 'A:Z',
        data: [['15/12/2023', 50, 'Category_3', '', 'descrizione multi token']],
      });
      await vi.waitFor(() => {
        if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
          throw 'Mock not called yet';
      });
      const calledWith = bot.sendMessage.mock.calls[0];
      expect(calledWith[0]).toBe(123);
      expect(calledWith[1]).toContain('Fatto!');
      expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
    });

    it('should ask for the subcategory if the selected category have subcategories', async () => {
      const categoryHandler = getHandler();
      await categoryHandler({ ...defaultMsg, text: 'Category_1' });

      const calledWith = bot.sendMessage.mock.calls[0];
      expect(calledWith[0]).toBe(123);
      expect(calledWith[1]).toContain('Scegli una sottocategoria');
      expect(bot.once).toHaveBeenCalled(); // tested with getSubcategoryHandler
      expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
    });
  });

  describe('getSubcategoryHandler', () => {
    const getHandler = () =>
      getSubcategoryHandler({
        // @ts-expect-error
        bot,
        // @ts-expect-error
        googleSheetClient: mockGoogleSheetClient,
        category: categories[0],
        chatId: 123,
        tokens: [
          'aggiungi',
          '20',
          'descrizione',
          'multi',
          'token',
          'Category_1',
        ],
        formattedDate: '15/12/2023',
        amount: 20,
        // @ts-expect-error
        analytics: mockAnalytics,
        // @ts-expect-error
        config: mockConfig,
      });

    it("should send an error message if the subcategory doesn't exist", async () => {
      const subCategoryHandler = getHandler();
      await subCategoryHandler({ ...defaultMsg, text: 'not-existing' });

      expect(bot.sendMessage).toHaveBeenCalledWith(
        123,
        'Cè stato un problema, reinserisci la spesa\n'
      );
      expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
    });

    it('should add the expense if the subcategory is correct', async () => {
      const subCategoryHandler = getHandler();
      await subCategoryHandler({ ...defaultMsg, text: 'Subcategory_1' });

      expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
        client: mockGoogleSheetClient,
        sheetId: 'sheet-id',
        tabName: 'tab-name',
        range: 'A:Z',
        data: [
          [
            '15/12/2023',
            20,
            'Category_1',
            'Subcategory_1',
            'descrizione multi token',
          ],
        ],
      });
      await vi.waitFor(() => {
        if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
          throw 'Mock not called yet';
      });
      const calledWith = bot.sendMessage.mock.calls[0];
      expect(calledWith[0]).toBe(123);
      expect(calledWith[1]).toContain('Fatto!');
      expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
    });
  });
});
