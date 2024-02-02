import { sheets_v4 } from 'googleapis';
import { readGoogleSheet, updateGoogleSheet } from '../google';

import type { CONFIG_TYPE } from '../config/config';

export class Analytics {
  client: sheets_v4.Sheets;
  config: CONFIG_TYPE['ANALYTICS'];

  constructor(
    googleSheetClient: sheets_v4.Sheets,
    config: CONFIG_TYPE,
    env: Environment
  ) {
    this.client = googleSheetClient;
    this.config = config.ANALYTICS;
  }

  /**
   * Return the current number of chats in which the bot is active
   */
  async getNumActiveChats(): Promise<number | undefined> {
    try {
      const resp = await readGoogleSheet({
        client: this.client,
        sheetId: this.config.SHEET_ID,
        tabName: this.config.TAB_NAME,
        range: this.config.ACTIVE_CHATS_RANGE,
      });
      const result = parseInt(resp?.[0]?.[1] ?? '');

      if (isNaN(result)) {
        console.error(`Error: active chats found is ${result}`);
        return undefined; // something wrong happened
      }

      return result;
    } catch (e) {
      console.error('Error while fetching active chats', e);
      return undefined;
    }
  }

  /**
   * Increase or decrease the number of active chats
   */
  async changeNumActiveChats(type: 'increase' | 'decrease') {
    // read the current value, then update it
    const currentValue = await this.getNumActiveChats();
    if (currentValue !== undefined) {
      const newValue =
        type === 'increase' ? currentValue + 1 : currentValue - 1;
      try {
        await updateGoogleSheet({
          client: this.client,
          sheetId: this.config.SHEET_ID,
          tabName: this.config.TAB_NAME,
          range: this.config.ACTIVE_CHATS_RANGE,
          data: [[this.config.ACTIVE_CHATS_LABEL, newValue]],
        });
      } catch (e) {
        console.error('Error while updating active chats', e);
        return undefined;
      }
    }
  }

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
        console.error(`Error: tracked expense found is ${result}`);
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
