import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Categories, _googleResultToCategories } from './categories';

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
  let categories: Categories;

  beforeEach(() => {
    // @ts-expect-error
    categories = new Categories(mockGoogleSheetClient, mockConfig);
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

describe('googleResultToCategories', () => {
  describe('should map categories stored in a google sheet to Categories', () => {
    expectations.forEach(({ text, input, output }) => {
      it(text, () => {
        expect(_googleResultToCategories(input)).toEqual(output);
      });
    });
  });
});

const expectations = [
  {
    text: 'With a mix of categories with and without subcategories',
    input: [
      ['Category 1', 'Subcategory 1', 'Subcategory 2'],
      ['Category 2', 'Subcategory 3', 'Subcategory 4'],
      ['Category 3'],
    ],
    output: [
      {
        name: 'Category 1',
        subCategories: [
          {
            name: 'Subcategory 1',
          },
          {
            name: 'Subcategory 2',
          },
        ],
      },
      {
        name: 'Category 2',
        subCategories: [
          {
            name: 'Subcategory 3',
          },
          {
            name: 'Subcategory 4',
          },
        ],
      },
      {
        name: 'Category 3',
        subCategories: [],
      },
    ],
  },
  {
    text: 'With only categories without subcategories',
    input: [['Category 1'], ['Category 2'], ['Category 3']],
    output: [
      {
        name: 'Category 1',
        subCategories: [],
      },
      {
        name: 'Category 2',
        subCategories: [],
      },
      {
        name: 'Category 3',
        subCategories: [],
      },
    ],
  },
  {
    text: 'With only categories with subcategories',
    input: [
      ['Category 1', 'Subcategory 1', 'Subcategory 2'],
      ['Category 2', 'Subcategory 3', 'Subcategory 4'],
      ['Category 3', 'Subcategory 5', 'Subcategory 6'],
    ],
    output: [
      {
        name: 'Category 1',
        subCategories: [
          {
            name: 'Subcategory 1',
          },
          {
            name: 'Subcategory 2',
          },
        ],
      },
      {
        name: 'Category 2',
        subCategories: [
          {
            name: 'Subcategory 3',
          },
          {
            name: 'Subcategory 4',
          },
        ],
      },
      {
        name: 'Category 3',
        subCategories: [
          {
            name: 'Subcategory 5',
          },
          {
            name: 'Subcategory 6',
          },
        ],
      },
    ],
  },
];
