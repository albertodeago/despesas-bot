export type CONFIG_TYPE = typeof CONFIG;

export const CONFIG = {
  sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs', // despesas
  // sheetId: '17higBTMCC09k95Dr_ccw7BRClxdkdBwT3dk9xqnpiVg', // despesas-2
  tabName: 'Spese',
  range: 'A:E',
  production: {
    ANALYTICS: {
      SHEET_ID: 'TODO:',
      TAB_NAME: 'analytics',
      TRACKED_EXPENSES_RANGE: 'A2:B2',
      TRACKED_EXPENSES_LABEL: 'Tracked expenses',
      ACTIVE_CHATS_RANGE: 'A1:B1',
      ACTIVE_CHATS_LABEL: 'Active chats',
    },
  },
  development: {
    ANALYTICS: {
      SHEET_ID: '18bmsNx-F-vK-NHavi_QCv2DisS6i7FKmTDPAa44Mdpk',
      TAB_NAME: 'analytics',
      TRACKED_EXPENSES_RANGE: 'A2:B2',
      TRACKED_EXPENSES_LABEL: 'Tracked expenses',
      ACTIVE_CHATS_RANGE: 'A1:B1',
      ACTIVE_CHATS_LABEL: 'Active chats',
    },
  },
  DEPLOY_CHAT_ID: '53084797',
};

export const UNCATEGORIZED_CATEGORY = 'NON CATEGORIZZATA';
