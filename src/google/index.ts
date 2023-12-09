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

export async function readGoogleSheet({
  client,
  sheetId,
  tabName,
  range,
}: {
  client: sheets_v4.Sheets;
  sheetId: SheetId;
  tabName: string;
  range: string;
}) {
  const res = await client.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!${range}`,
  });

  return res.data.values as string[][] | null | undefined;
}

export type ExpenseRow = [string, number, string, string, string]; // TODO: type this better date, categories, subcategories
export async function writeGoogleSheet({
  client,
  sheetId,
  tabName,
  range,
  data,
}: {
  client: sheets_v4.Sheets;
  sheetId: SheetId;
  tabName: string;
  range: string;
  data: ExpenseRow[];
}) {
  await client.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!${range}`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      majorDimension: 'ROWS',
      values: data,
    },
  });
}
