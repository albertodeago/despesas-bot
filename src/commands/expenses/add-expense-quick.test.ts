import { describe, expect, vi, it, afterEach } from 'vitest';
import { AddExpenseQuickCommand } from './add-expense-quick';
import TelegramBot from 'node-telegram-bot-api';
import { UNCATEGORIZED_CATEGORY } from '../../config/config';

// TODO: in this file we probably should mock the sheetId, tabName, range, etc...

const mocks = vi.hoisted(() => {
  return {
    spyWriteGoogleSheet: vi.fn(() => Promise.resolve()),
  };
});
vi.mock('../../google', () => ({
  writeGoogleSheet: mocks.spyWriteGoogleSheet,
}));

const bot = {
  sendMessage: vi.fn(),
  once: vi.fn(),
};
const mockGoogleSheetClient = {};
const defaultMsg: TelegramBot.Message = {
  text: 'aggiungi veloce 20 descrizione abbastanza lunga',
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

describe('AddExpenseQuickCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should match "aggiungi veloce"', () => {
    expect(AddExpenseQuickCommand.pattern.test('aggiungi ')).toBe(false);
    expect(AddExpenseQuickCommand.pattern.test('aggiungi')).toBe(false);
    expect(AddExpenseQuickCommand.pattern.test('aggiung')).toBe(false);
    expect(AddExpenseQuickCommand.pattern.test('aggiungi 10')).toBe(false);
    expect(AddExpenseQuickCommand.pattern.test('aggiungi veloce')).toBe(true);
    expect(AddExpenseQuickCommand.pattern.test('aggiungi vel')).toBe(false);
    expect(AddExpenseQuickCommand.pattern.test('aggiungi veloce 30,5')).toBe(
      true
    );
    expect(
      AddExpenseQuickCommand.pattern.test(
        'aggiungi veloce 50 descrizione incredibile'
      )
    ).toBe(true);
  });

  it('should send a explanation message if the amount is not a number', () => {
    const handler = AddExpenseQuickCommand.getHandler(
      bot,
      mockGoogleSheetClient,
      mockAnalytics
    );
    handler({ ...defaultMsg, text: 'aggiungi veloce merda in salotto' });

    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain("L'importo dev'essere un numero");
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  it("should add the expense also if the message doesn't have a description (uncategorized)", async () => {
    const handler = AddExpenseQuickCommand.getHandler(
      bot,
      mockGoogleSheetClient,
      mockAnalytics
    );
    handler({
      ...defaultMsg,
      text: 'aggiungi veloce 20',
    });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs',
      tabName: 'Spese',
      range: 'A:E',
      data: [
        ['15/12/2023', 20, UNCATEGORIZED_CATEGORY, UNCATEGORIZED_CATEGORY, ''],
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

  it('should add the expense with the provided description (uncategorized)', async () => {
    const handler = AddExpenseQuickCommand.getHandler(
      bot,
      mockGoogleSheetClient,
      mockAnalytics
    );
    handler({
      ...defaultMsg,
      text: 'aggiungi veloce 20 descrizione',
    });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs',
      tabName: 'Spese',
      range: 'A:E',
      data: [
        [
          '15/12/2023',
          20,
          UNCATEGORIZED_CATEGORY,
          UNCATEGORIZED_CATEGORY,
          'descrizione',
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

  it('should add the expense with the provided long description (uncategorized)', async () => {
    const handler = AddExpenseQuickCommand.getHandler(
      bot,
      mockGoogleSheetClient,
      mockAnalytics
    );
    handler({
      ...defaultMsg,
      text: 'aggiungi veloce 20 descrizione incredibilmente verbosa',
    });

    expect(mocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs',
      tabName: 'Spese',
      range: 'A:E',
      data: [
        [
          '15/12/2023',
          20,
          UNCATEGORIZED_CATEGORY,
          UNCATEGORIZED_CATEGORY,
          'descrizione incredibilmente verbosa',
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
