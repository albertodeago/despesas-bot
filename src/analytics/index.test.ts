import { expect, it, describe, vi, beforeEach } from 'vitest';
import { Analytics } from './index';

const spyGet = vi.fn(() =>
  Promise.resolve({
    data: {
      values: [['label', '5']],
    },
  })
);
const spyUpdate = vi.fn(() => Promise.resolve({ data: {} }));

const mockGoogleSheetClient = {
  spreadsheets: {
    values: {
      get: spyGet,
      update: spyUpdate,
    },
  },
};
const mockConfig = {
  development: {
    ANALYTICS: {
      SHEET_ID: 'sheet-id',
      TAB_NAME: 'tab-name',
      TRACKED_EXPENSES_RANGE: 'A2:B2',
      TRACKED_EXPENSES_LABEL: 'Tracked expenses',
      ACTIVE_CHATS_RANGE: 'A1:B1',
      ACTIVE_CHATS_LABEL: 'Active chats',
    },
  },
};
describe('Analytics', () => {
  const analytics = new Analytics(
    // @ts-expect-error
    mockGoogleSheetClient,
    mockConfig,
    'development'
  );

  beforeEach(() => {
    spyGet.mockClear();
    spyUpdate.mockClear();
  });

  it('should be created and defined', () => {
    expect(analytics).toBeDefined();
  });

  describe('getTrackedExpenses', () => {
    it('should be able to get the tracked expenses', async () => {
      const result = await analytics.getTrackedExpenses();
      expect(result).toBe(5);
    });

    it('should return undefined if it s not able to get the tracked expenses', async () => {
      spyGet.mockImplementationOnce(() => Promise.reject('error'));
      console.error = vi.fn();
      const result = await analytics.getTrackedExpenses();
      expect(console.error).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should return undefined if the value is not a number', async () => {
      spyGet.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            values: [['Tracked expenses', 'not a number']],
          },
        })
      );
      console.error = vi.fn();
      const result = await analytics.getTrackedExpenses();
      expect(console.error).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('addTrackedExpense', () => {
    it('should be able to add a tracked expense', async () => {
      await analytics.addTrackedExpense();
      expect(spyUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'sheet-id',
        range: 'tab-name!A2:B2',
        valueInputOption: 'RAW',
        requestBody: {
          majorDimension: 'ROWS',
          values: [['Tracked expenses', 6]],
        },
      });
    });

    it('should not update the value if it s not able to get the tracked expenses', async () => {
      spyGet.mockImplementationOnce(() => Promise.reject('error'));
      await analytics.addTrackedExpense();
      expect(spyGet).toHaveBeenCalled();
      expect(spyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getNumActiveChats', () => {
    it('should be able to get the number of active chats', async () => {
      const result = await analytics.getNumActiveChats();
      expect(result).toBe(5);
    });

    it('should return undefined if it s not able to get the tracked expenses', async () => {
      spyGet.mockImplementationOnce(() => Promise.reject('error'));
      console.error = vi.fn();
      const result = await analytics.getTrackedExpenses();
      expect(console.error).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should return undefined if the value is not a number', async () => {
      spyGet.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            values: [['Active chats', 'not a number']],
          },
        })
      );
      console.error = vi.fn();
      const result = await analytics.getTrackedExpenses();
      expect(console.error).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('changeNumActiveChats', () => {
    it('should be able to increase the number of active chats', async () => {
      await analytics.changeNumActiveChats('increase');
      expect(spyUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'sheet-id',
        range: 'tab-name!A1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          majorDimension: 'ROWS',
          values: [['Active chats', 6]],
        },
      });
    });

    it('should be able to decrease the number of active chats', async () => {
      await analytics.changeNumActiveChats('decrease');
      expect(spyUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'sheet-id',
        range: 'tab-name!A1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          majorDimension: 'ROWS',
          values: [['Active chats', 4]],
        },
      });
    });

    it('should not update the value if it s not able to get the tracked expenses', async () => {
      spyGet.mockImplementationOnce(() => Promise.reject('error'));
      await analytics.changeNumActiveChats('increase');
      expect(spyGet).toHaveBeenCalled();
      expect(spyUpdate).not.toHaveBeenCalled();
    });
  });
});
