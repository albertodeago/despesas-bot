import { sheets_v4 } from 'googleapis';
import { readGoogleSheet, updateGoogleSheet } from '../google';

import type { CONFIG_TYPE } from '../config/config';

export class Analytics {
  client: sheets_v4.Sheets;
  config: CONFIG_TYPE[Environment]['ANALYTICS'];

  constructor(
    googleSheetClient: sheets_v4.Sheets,
    config: CONFIG_TYPE,
    env: Environment
  ) {
    this.client = googleSheetClient;
    this.config = config[env].ANALYTICS;
  }

  setActiveChats() {}

  /**
   * Return the current number of tracked expenses
   */
  async getTrackedExpenses(): Promise<number | undefined> {
    try {
      const resp = await readGoogleSheet({
        client: this.client,
        sheetId: this.config.SHEET_ID,
        tabName: this.config.TAB_NAME,
        range: this.config.TRACKED_EXPENSES_RANGE,
      });
      const result = parseInt(resp?.[0]?.[1] ?? '');

      if (isNaN(result)) {
        console.error('No tracked expenses found');
        return undefined; // something wrong happened
      }

      return result;
    } catch (e) {
      console.error('Error while fetching tracked expenses', e);
      return undefined;
    }
  }

  /**
   * Read the current tracked expenses, then update it with a +1
   */
  async addTrackedExpense() {
    // read the current value, then update it
    const currentValue = await this.getTrackedExpenses();
    if (currentValue !== undefined) {
      try {
        await updateGoogleSheet({
          client: this.client,
          sheetId: this.config.SHEET_ID,
          tabName: this.config.TAB_NAME,
          range: this.config.TRACKED_EXPENSES_RANGE,
          data: [[this.config.TRACKED_EXPENSES_LABEL, currentValue + 1]],
        });
      } catch (e) {
        console.error('Error while updating tracked expenses', e);
        return undefined;
      }
    }
  }
}
