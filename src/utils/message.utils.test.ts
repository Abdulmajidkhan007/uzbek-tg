import { getInitials } from './message.utils';

describe('getInitials', () => {
  it('bo\'sh ism uchun "?" qaytaradi', () => {
    expect(getInitials('   ')).toBe('?');
  });

  it('ikki so\'zli ismdan bosh harflarni oladi', () => {
    expect(getInitials('Ali Valiyev')).toBe('AV');
  });
});
