import { describe, expect, vi, it, afterEach } from 'vitest';
import { AddExpenseCommand } from './add-expense';
import TelegramBot from 'node-telegram-bot-api';

// TODO: in this file we probably should mock the sheetId, tabName, range, etc...

const mocks = vi.hoisted(() => {
  return {
    spyWriteGoogleSheet: vi.fn(() => Promise.resolve()),
  };
});
vi.mock('../../google', () => ({
  writeGoogleSheet: mocks.spyWriteGoogleSheet,
}));

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

describe('AddExpenseCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should match "aggiungi"', () => {
    expect(AddExpenseCommand.pattern.test('aggiungi')).toBe(true);
    expect(AddExpenseCommand.pattern.test('aggiung')).toBe(false);
    expect(AddExpenseCommand.pattern.test('aggiungi 10')).toBe(true);
  });

  it("should send a explanation message if it doesn't have the necessary info to answer", () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({ ...defaultMsg, text: 'aggiungi' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Per aggiungere una spesa, scrivere');
  });

  it('should send a explanation message if the amount is not a number', () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({ ...defaultMsg, text: 'aggiungi merda in casa' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain("L'importo dev'essere un numero");
  });

  it('should add the expense if the message finish with a category with no subcategories', async () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({ ...defaultMsg, text: 'aggiungi 20 descrizione Category_3' });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs',
      tabName: 'Spese',
      range: 'A:E',
      data: [['15/12/2023', 20, 'Category_3', '', 'descrizione']],
    });
    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
  });

  it("should ask for the subcategory if the message doesn't finish with a category with no subcategories", () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({ ...defaultMsg, text: 'aggiungi 20 descrizione Category_1' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Scegli una sottocategoria');

    // we also set a once listener after this
    expect(bot.once).toHaveBeenCalled(); // TODO: we should export the handler for the once and test it
  });

  it('should send an error message if the second last token is a category but the last one is not a subcategory', () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({
      ...defaultMsg,
      text: 'aggiungi 20 descrizione Category_1 merda',
    });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain(
      'Non sono riuscito ad individuare la categoria e sotto categoria, reinserisci la spesa'
    );
  });

  it('should add the expense if the message finish with a category and subcategory', async () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler(defaultMsg);

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs',
      tabName: 'Spese',
      range: 'A:E',
      data: [['15/12/2023', 20, 'Category_1', 'Subcategory_1', 'descrizione']],
    });
    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
  });

  it("should add the expense also if the message doesn't have a description", async () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({
      ...defaultMsg,
      text: 'aggiungi 20 Category_1 Subcategory_1',
    });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs',
      tabName: 'Spese',
      range: 'A:E',
      data: [['15/12/2023', 20, 'Category_1', 'Subcategory_1', '']],
    });
    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
  });

  it("should ask to select a category if the message doesn't provide one", () => {
    const handler = AddExpenseCommand.getHandler(
      // @ts-expect-error
      bot,
      categories,
      mockGoogleSheetClient
    );
    handler({
      ...defaultMsg,
      text: 'aggiungi 20 descrizione del cazzo ma senza una categoria',
    });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Scegli una categoria');
    expect(bot.once).toHaveBeenCalled(); // TODO: we should export the handler for the once and test it
  });
});
