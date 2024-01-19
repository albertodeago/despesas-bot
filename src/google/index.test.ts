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
});
