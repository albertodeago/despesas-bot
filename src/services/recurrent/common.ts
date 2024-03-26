
export type RecurrentFrequency = 'settimanale' | 'mensile' | 'bimestrale' | 'trimestrale';

// Last added date is either what we find, or we set a default value (1 year ago, just to be sure the bot will consider it due)
export const getDateWithFallback = (date: string): Date => {
  if (date) {
    return new Date(date);
  } else {
    const lastAddedDate = new Date();
    lastAddedDate.setFullYear(lastAddedDate.getFullYear() - 1);
    return lastAddedDate;
  }
};