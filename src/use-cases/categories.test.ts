import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Categories, clearCache } from './categories';

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

  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  it('should return the categories from the specified sheetId', async () => {
    const result = await categories.get('sheet-id');

    const tmp = spyGet.mock.calls[0];
    // @ts-ignore - not sure why but this has a wrong type
    const calledParams = spyGet.mock.calls[0][0] as unknown as {
      range: string;
      spreadsheetId: string;
    };
    expect(calledParams!.range).toEqual('tab-name!range');
    expect(calledParams!.spreadsheetId).toEqual('sheet-id');
    expect(result.length).toEqual(3);
    expect(result[0].name).toEqual('other');
    expect(result[1].subCategories).toHaveLength(2);
    expect(result[2].subCategories).toHaveLength(4);
  });

  it('should cache the result and thus not refetching the categories if asked twice', async () => {
    const result = await categories.get('sheet-id');
    const cached = await categories.get('sheet-id');

    expect(result).toEqual(cached);
    expect(spyGet.mock.calls).toHaveLength(1);
  });
});
