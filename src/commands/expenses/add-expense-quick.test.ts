import { describe, expect, vi, it, afterEach, beforeEach } from 'vitest';
import { AddExpenseQuickCommand } from './add-expense-quick';
import TelegramBot from 'node-telegram-bot-api';
import { UNCATEGORIZED_CATEGORY } from '../../config/config';

// TODO: in this file we probably should mock the sheetId, tabName, range, etc...
// ^ is the above comment still valid?

// TODO: can we centralize the mocks? a lot of redundant info between tests

const googleMocks = vi.hoisted(() => ({
  spyWriteGoogleSheet: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../google', () => ({
  writeGoogleSheet: googleMocks.spyWriteGoogleSheet,
}));
const chatsConfigMocks = vi.hoisted(() => ({
  isChatActiveInConfiguration: () => Promise.resolve(true),
}));
vi.mock('../../use-cases/chats-configuration', () => ({
  isChatActiveInConfiguration: chatsConfigMocks.isChatActiveInConfiguration,
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
const mockConfig = {
  sheetId: 'sheet-id',
  tabName: 'tab-name',
  range: 'A:Z',
};

const waitMessage = async () => {
  await vi.waitFor(() => {
    if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
      throw 'Mock not called yet';
  });
};

describe('AddExpenseQuickCommand', () => {
  let handler: ReturnType<typeof AddExpenseQuickCommand.getHandler>;

  beforeEach(() => {
    handler = AddExpenseQuickCommand.getHandler({
      // @ts-expect-error
      bot,
      // @ts-expect-error
      googleSheetClient: mockGoogleSheetClient,
      // @ts-expect-error
      analytics: mockAnalytics,
      // @ts-expect-error
      config: mockConfig,
    });
  });

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

  it('should send a explanation message if the amount is not a number', async () => {
    handler({ ...defaultMsg, text: 'aggiungi veloce merda in salotto' });

    await waitMessage();
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain("L'importo dev'essere un numero");
    expect(mockAnalytics.addTrackedExpense).not.toHaveBeenCalled();
  });

  it("should add the expense also if the message doesn't have a description (uncategorized)", async () => {
    handler({
      ...defaultMsg,
      text: 'aggiungi veloce 20',
    });

    await waitMessage();
    expect(googleMocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:Z',
      data: [
        ['15/12/2023', 20, UNCATEGORIZED_CATEGORY, UNCATEGORIZED_CATEGORY, ''],
      ],
    });
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
    expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
  });

  it('should add the expense with the provided description (uncategorized)', async () => {
    handler({
      ...defaultMsg,
      text: 'aggiungi veloce 20 descrizione',
    });

    await waitMessage();
    expect(googleMocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:Z',
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
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
    expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
  });

  it('should add the expense with the provided long description (uncategorized)', async () => {
    handler({
      ...defaultMsg,
      text: 'aggiungi veloce 20 descrizione incredibilmente verbosa',
    });

    await waitMessage();
    expect(googleMocks.spyWriteGoogleSheet).toHaveBeenCalledWith({
      client: mockGoogleSheetClient,
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:Z',
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
    const calledWith = bot.sendMessage.mock.calls[0];
    expect(calledWith[0]).toBe(123);
    expect(calledWith[1]).toContain('Fatto!');
    expect(mockAnalytics.addTrackedExpense).toHaveBeenCalled();
  });
});
