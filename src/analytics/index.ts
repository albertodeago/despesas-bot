import type { CONFIG_TYPE } from '../config/config';
import type { Logger } from '../logger';
import type { GoogleService } from '../services/google';

export type Analytics = ReturnType<typeof initAnalytics>;

export const initAnalytics = ({
  config,
  logger,
  googleService,
}: {
  config: Pick<CONFIG_TYPE, 'ANALYTICS'>;
  logger: Logger;
  googleService: GoogleService;
}) => {
  const analyticsConfig = config.ANALYTICS;
  /**
   * Return the current number of tracked expenses
   * NOTE: This is public just for testing purposes, should not be used out of the class
   */
  const _getTrackedExpenses = async (): Promise<number | undefined> => {
    try {
      const resp = await googleService.readGoogleSheet({
        sheetId: analyticsConfig.SHEET_ID,
        tabName: analyticsConfig.TAB_NAME,
        range: analyticsConfig.TRACKED_EXPENSES_RANGE,
      });
      const result = parseInt(resp?.[0]?.[1] ?? '');

      if (isNaN(result)) {
        const err = new Error(
          `Error: tracked expense found is ${result} (NaN)`
        );
        logger.sendError(err, 'NO_CHAT');
        return undefined; // something wrong happened
      }

      return result;
    } catch (e) {
      const err = new Error(`Error while fetching tracked expenses: ${e}`);
      logger.sendError(err, 'NO_CHAT');
      return undefined;
    }
  };

  /**
   * Read the current tracked expenses, then update it with a +1
   */
  const addTrackedExpense = async () => {
    // read the current value, then update it
    const currentValue = await _getTrackedExpenses();
    if (currentValue !== undefined) {
      try {
        await googleService.updateGoogleSheet({
          sheetId: analyticsConfig.SHEET_ID,
          tabName: analyticsConfig.TAB_NAME,
          range: analyticsConfig.TRACKED_EXPENSES_RANGE,
          data: [[analyticsConfig.TRACKED_EXPENSES_LABEL, currentValue + 1]],
        });
      } catch (e) {
        const err = new Error(`Error while updating tracked expenses: ${e}`);
        logger.sendError(err, 'NO_CHAT');
        return undefined;
      }
    }
  };

  /**
   * Return the current number of tracked recurrent expenses
   * NOTE: This is public just for testing purposes, should not be used out of the class
   */
  const _getTrackedRecurrentExpenses = async (): Promise<
    number | undefined
  > => {
    try {
      const resp = await googleService.readGoogleSheet({
        sheetId: analyticsConfig.SHEET_ID,
        tabName: analyticsConfig.TAB_NAME,
        range: analyticsConfig.TRACKED_RECURRENT_EXPENSES_RANGE,
      });
      const result = parseInt(resp?.[0]?.[1] ?? '');

      if (isNaN(result)) {
        const err = new Error(
          `Error: tracked expense found is ${result} (NaN)`
        );
        logger.sendError(err, 'NO_CHAT');
        return undefined; // something wrong happened
      }

      return result;
    } catch (e) {
      const err = new Error(`Error while fetching tracked expenses: ${e}`);
      logger.sendError(err, 'NO_CHAT');
      return undefined;
    }
  };

  /**
   * Read the current tracked recurrent expenses, then update it with a +1
   */
  const addTrackedRecurrentExpense = async () => {
    // read the current value, then update it
    const currentValue = await _getTrackedRecurrentExpenses();
    if (currentValue !== undefined) {
      try {
        await googleService.updateGoogleSheet({
          sheetId: analyticsConfig.SHEET_ID,
          tabName: analyticsConfig.TAB_NAME,
          range: analyticsConfig.TRACKED_RECURRENT_EXPENSES_RANGE,
          data: [
            [
              analyticsConfig.TRACKED_RECURRENT_EXPENSES_LABEL,
              currentValue + 1,
            ],
          ],
        });
      } catch (e) {
        const err = new Error(
          `Error while updating tracked recurrent expenses: ${e}`
        );
        logger.sendError(err, 'NO_CHAT');
        return undefined;
      }
    }
  };

  return {
    _getTrackedExpenses,
    addTrackedExpense,
    _getTrackedRecurrentExpenses,
    addTrackedRecurrentExpense,
  };
};
