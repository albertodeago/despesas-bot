import { expect, it, describe, vi, beforeEach } from 'vitest';
import { initAnalytics } from './index';
import { getMockLogger } from '../logger/mock';
import { getMockGoogleService } from '../services/google/mock';

const spyRead = vi.fn(() => Promise.resolve([['label', '5']]));
const spyUpdate = vi.fn(() => Promise.resolve());

const mockGoogleService = getMockGoogleService({
  spyRead,
  // @ts-expect-error
  spyUpdate,
});
const mockConfig = {
  ANALYTICS: {
    SHEET_ID: 'sheet-id',
    TAB_NAME: 'tab-name',
    TRACKED_EXPENSES_RANGE: 'A1:B1',
    TRACKED_EXPENSES_LABEL: 'Tracked expenses',
  },
};
const mockLogger = getMockLogger();
describe('Analytics', () => {
  const analytics = initAnalytics({
    config: mockConfig,
    logger: mockLogger,
    googleService: mockGoogleService,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be created and defined', () => {
    expect(analytics).toBeDefined();
  });

  describe('getTrackedExpenses', () => {
    it('should be able to get the tracked expenses', async () => {
      const result = await analytics._getTrackedExpenses();
      expect(result).toBe(5);
    });

    it('should return undefined if it s not able to get the tracked expenses', async () => {
      spyRead.mockImplementationOnce(() => Promise.reject('error'));
      const result = await analytics._getTrackedExpenses();
      expect(mockLogger.sendError).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should return undefined if the value is not a number', async () => {
      spyRead.mockImplementationOnce(() =>
        Promise.resolve([['Tracked expenses', 'not a number']])
      );
      const result = await analytics._getTrackedExpenses();
      expect(mockLogger.sendError).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('addTrackedExpense', () => {
    it.only('should be able to add a tracked expense', async () => {
      await analytics.addTrackedExpense();
      expect(spyUpdate).toHaveBeenCalledWith({
        sheetId: 'sheet-id',
        range: 'A1:B1',
        tabName: 'tab-name',
        data: [['Tracked expenses', 6]],
      });
    });

    it('should not update the value if it s not able to get the tracked expenses', async () => {
      spyRead.mockImplementationOnce(() => Promise.reject('error'));
      await analytics.addTrackedExpense();
      expect(spyRead).toHaveBeenCalled();
      expect(spyUpdate).not.toHaveBeenCalled();
    });
  });
});
