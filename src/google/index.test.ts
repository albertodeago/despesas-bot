import { readGoogleSheet, updateGoogleSheet } from '.';
import { expect, test, describe } from 'vitest';

describe('Google', () => {
  test('readGoogleSheet', async () => {
    const data = await readGoogleSheet({
      client: {
        spreadsheets: {
          values: {
            // @ts-expect-error
            get: async () => ({
              data: {
                values: [
                  ['a', 'b'],
                  ['c', 'd'],
                ],
              },
            }),
          },
        },
      },
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:B',
    });

    expect(data).toStrictEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('updateGoogleSheet', async () => {
    const mockResp = {
      spreadsheetId: 'sheet-id',
      updatedRange: 'tab-name!A1:B1',
      updatedRows: 2,
      updatedColumns: 1,
      updatedCells: 2,
    };
    const data = await updateGoogleSheet({
      client: {
        spreadsheets: {
          values: {
            // @ts-expect-error
            update: async () => ({ data: mockResp }),
          },
        },
      },
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A1:B1',
      data: [['a', 'b']],
    });

    expect(data).toStrictEqual(mockResp);
  });

  test('appendGoogleSheet - append single row', async () => {
    const mockResp = {
      spreadsheetId: 'sheet-id',
      tableRange: 'tab-name!A1:B4', // means that until row 4 we have data
      updates: {
        spreadsheetId: 'sheet-id',
        updatedRange: 'tab-name!A5:B5', // means that it added one new row (5)
        updatedRows: 1,
        updatedColumns: 2,
        updatedCells: 2,
      },
    };
    const data = await updateGoogleSheet({
      client: {
        spreadsheets: {
          values: {
            // @ts-expect-error
            update: async () => ({ data: mockResp }),
          },
        },
      },
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:B',
      data: [['a', 'b']],
    });

    expect(data).toStrictEqual(mockResp);
  });

  test('appendGoogleSheet - append multiple rows', async () => {
    const mockResp = {
      spreadsheetId: 'sheet-id',
      tableRange: 'tab-name!A1:B4', // means that until row 4 we have data
      updates: {
        spreadsheetId: 'sheet-id',
        updatedRange: 'tab-name!A5:B6', // means that it added one two rows (5 and 6)
        updatedRows: 2,
        updatedColumns: 2,
        updatedCells: 4,
      },
    };
    const data = await updateGoogleSheet({
      client: {
        spreadsheets: {
          values: {
            // @ts-expect-error
            update: async () => ({ data: mockResp }),
          },
        },
      },
      sheetId: 'sheet-id',
      tabName: 'tab-name',
      range: 'A:B',
      data: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    });

    expect(data).toStrictEqual(mockResp);
  });
});
