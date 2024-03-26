import { vi } from 'vitest';
import type { GoogleService } from '.';

const defaultSpyRead = vi.fn(async () => [['a', 'b']]);
const defaultSpyAppend = vi.fn(async () => ({
  spreadsheetId: 'sheet-id',
  tableRange: 'tab-name!A1:B4', // means that until row 4 we have data
  updates: {
    spreadsheetId: 'sheet-id',
    updatedRange: 'tab-name!A5:B5', // means that it added one new row (5)
    updatedRows: 1,
    updatedColumns: 2,
    updatedCells: 2,
  },
}));
const defaultSpyUpdate = async () => ({
  spreadsheetId: 'sheet-id',
  updatedRange: 'tab-name!A1:B1',
  updatedRows: 2,
  updatedColumns: 1,
  updatedCells: 2,
});

const defaultSpies = {
  spyRead: defaultSpyRead,
  spyAppend: defaultSpyAppend,
  spyUpdate: defaultSpyUpdate,
};

type Params = {
  spyRead?: typeof defaultSpyRead;
  spyAppend?: typeof defaultSpyAppend;
  spyUpdate?: typeof defaultSpyUpdate;
};

export const getMockGoogleService = ({
  spyRead = defaultSpyRead,
  spyAppend = defaultSpyAppend,
  spyUpdate = defaultSpyUpdate,
}: Params = defaultSpies): GoogleService => {
  return {
    readGoogleSheet: spyRead,
    appendGoogleSheet: spyAppend,
    updateGoogleSheet: spyUpdate,
  };
};
