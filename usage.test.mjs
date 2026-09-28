import { test } from 'node:test';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { accountIdFromToken, formatWindow, parseUsage } from './usage.ts';

test('parses five-hour and weekly usage windows', () => {
  deepStrictEqual(parseUsage({ rate_limit: {
    primary_window: { used_percent: 28, reset_at: 1900000000 },
    secondary_window: { used_percent: 60, reset_at: 1900500000 },
  } }), {
    fiveHour: { usedPercent: 28, resetAt: 1900000000 },
    weekly: { usedPercent: 60, resetAt: 1900500000 },
  });
  strictEqual(formatWindow('5h', { usedPercent: 28 }), '5h: 72% left');
  const now = 1900000000000;
  const resetAt = (now + ((4 * 24 + 3) * 60 + 2) * 60000) / 1000;
  strictEqual(formatWindow('week', { usedPercent: 60, resetAt }, true, now),
    'week: 40% left, resets in 4d 3h 2m');
  strictEqual(formatWindow('5h', { usedPercent: 28, resetAt: (now + 30000) / 1000 }, true, now),
    '5h: 72% left, resets in <1m');
  strictEqual(formatWindow('5h', { usedPercent: 28, resetAt: (now - 1000) / 1000 }, true, now),
    '5h: 72% left, reset due');
  strictEqual(formatWindow('week', { usedPercent: 60, resetAt }, false, now),
    `week: 40% left, resets in 4d 3h 2m (${new Date(resetAt * 1000).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })})`);
});

test('rejects missing or malformed windows', () => {
  throws(() => parseUsage({ rate_limit: { primary_window: { used_percent: '28' } } }));
  throws(() => parseUsage(null));
});

test('extracts account id without exposing the token', () => {
  const token = `x.${Buffer.from(JSON.stringify({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acct' } })).toString('base64url')}.y`;
  strictEqual(accountIdFromToken(token), 'acct');
  strictEqual(accountIdFromToken('bad'), undefined);
});
