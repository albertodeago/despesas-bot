import { vi } from 'vitest';
import type { Analytics } from '.';

export const getMockAnalytics = (): Analytics => {
  return {
    _getTrackedExpenses: vi.fn(),
    addTrackedExpense: vi.fn(),
    _getTrackedRecurrentExpenses: vi.fn(),
    addTrackedRecurrentExpense: vi.fn(),
  };
};
