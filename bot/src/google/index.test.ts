import { readGoogleSheet } from '.';
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
});
