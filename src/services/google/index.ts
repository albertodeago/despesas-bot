import { google, sheets_v4 } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getGoogleSheetClient({
  clientEmail,
  privateKey,
}: {
  clientEmail: string;
  privateKey: string;
}): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });

  const authClient = await auth.getClient();

  return google.sheets({
    version: 'v4',
    auth: authClient,
  });
}

export type GoogleService = ReturnType<typeof initGoogleService>;

export const initGoogleService = (client: sheets_v4.Sheets) => {
  /**
   * Read from a google sheet
   * 
   * N.B: this method *throws* if the sheet is not found
   */
  const readGoogleSheet = async ({
    sheetId,
    tabName,
    range,
  }: {
    sheetId: string;
    tabName: string;
    range: string;
  }) => {
    const res = await client.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!${range}`,
    });

    return res.data.values as string[][] | null | undefined;
  };

  /**
   * Docs: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append
   * Examples of usage:
   *
   * Append one row (two cells)
   * const resp = await appendGoogleSheet({
   *   client: googleSheetClient,
   *   sheetId: 'sheet-id',
   *   tabName: 'tab-name',
   *   range: 'A:B',                <- columns, no need to specify the rows because we append
   *   data: [['a', 'b']],          <- one row - two cells
   * });
   *
   * Append 3 rows with 1 cell each
   * const resp = await appendGoogleSheet({
   *   client: googleSheetClient,
   *   sheetId: 'sheet-id',
   *   tabName: 'tab-name',
   *   range: 'A:B',                <- columns, no need to specify the rows because we append
   *   data: [['a'], ['b'], ['c']], <- three row with one cell
   * });
   */
  const appendGoogleSheet = async ({
    sheetId,
    tabName,
    range,
    data,
    valueInputOption = 'RAW',
    insertDataOption = 'INSERT_ROWS',
  }: {
    sheetId: SheetId;
    tabName: string;
    range: string;
    data: any[] | any[][];
    valueInputOption?: 'RAW' | 'USER_ENTERED';
    insertDataOption?: 'INSERT_ROWS' | 'OVERWRITE';
  }) => {
    const resp = await client.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}!${range}`,
      valueInputOption,
      insertDataOption,
      requestBody: {
        majorDimension: 'ROWS',
        values: data,
      },
    });
    return resp.data;
  };

  /**
   * Example of usage (update one row (two cells, like the analytics active chats))
   *
   * const resp = await updateGoogleSheet({
   *   client: googleSheetClient,
   *   sheetId: 'sheet-id',
   *   tabName: 'tab-name',
   *   range: 'A1:B1',                  <- one row - two cells
   *   data: [['Active chats', '5']],   <- one row - two cells
   * });
   *
   */
  const updateGoogleSheet = async ({
    sheetId,
    tabName,
    range,
    data,
  }: {
    sheetId: string;
    tabName: string;
    range: string;
    data: any[];
  }) => {
    const resp = await client.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!${range}`,
      valueInputOption: 'RAW',
      requestBody: {
        majorDimension: 'ROWS',
        values: data,
      },
    });

    return resp.data;
  };

  return {
    readGoogleSheet,
    appendGoogleSheet,
    updateGoogleSheet,
  };
};
