import { vi, describe, it, expect } from 'vitest';
import { Categories } from './categories';

const spyGet = vi.fn(() =>
  Promise.resolve({
    data: {
      values: [
        // ['Categories', 'Sub-categories'], This is not returned
        ['other'],
        ['food', 'grocery', 'restaurant'],
        ['home', 'maintenance', 'garden', 'forniture', 'other'],
      ],
    },
  })
);

const mockGoogleSheetClient = {
  spreadsheets: {
    values: {
      get: spyGet,
    },
  },
};
const mockConfig = {
  CATEGORIES: {
    TAB_NAME: 'tab-name',
    RANGE: 'range',
  },
};

describe('USE-CASE: categories', () => {
  // @ts-expect-error
  const categories = new Categories(mockGoogleSheetClient, mockConfig);

  it('should return the categories from the specified sheetId', async () => {
    const result = await categories.get('sheet-id');

    const calledParams = spyGet.mock.calls[0][0];
    expect(calledParams!.range).toEqual('tab-name!range');
    expect(calledParams!.spreadsheetId).toEqual('sheet-id');
    expect(result.length).toEqual(3);
    expect(result[0].name).toEqual('other');
    expect(result[1].subCategories).toHaveLength(2);
    expect(result[2].subCategories).toHaveLength(4);
  });

  it.todo(
    'should cache the result and thus not refetching the categories if asked twice'
  );

  it.todo('should refetch the categories if the cache TTL passed');
});
