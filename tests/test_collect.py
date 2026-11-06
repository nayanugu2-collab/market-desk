import unittest

from scripts.collect import build_snapshot, merge_asset


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.asset = {'symbol': 'CL=F', 'name': 'WTI', 'currency': 'USD'}
        self.quote = {'regularMarketPrice': -1, 'currency_matches': True,
                      'quote_time_utc': '2026-01-01T00:00:00+00:00',
                      'fetched_at_utc': '2026-01-01T00:01:00+00:00'}

    def test_negative_and_zero_prices_are_valid(self):
        for price in (-1, 0):
            row = merge_asset(self.asset, {**self.quote, 'regularMarketPrice': price})
            self.assertEqual(row['price'], price)
            self.assertEqual(row['status'], 'ok')

    def test_failed_quote_preserves_previous_time(self):
        previous = merge_asset(self.asset, self.quote)
        row = merge_asset(self.asset, {}, previous)
        self.assertEqual(row['quote_at'], previous['quote_at'])
        self.assertEqual(row['price'], -1)
        self.assertEqual(row['status'], 'stale')

    def test_currency_mismatch_and_nonfinite_rejected(self):
        for fields in ({'currency_matches': False}, {'regularMarketPrice': float('nan')}):
            self.assertEqual(merge_asset(self.asset, {**self.quote, **fields})['status'], 'failed')

    def test_all_failure_does_not_replace_snapshot(self):
        with self.assertRaises(RuntimeError):
            build_snapshot([self.asset], [{}], {})

    def test_demo_never_carried_into_live_snapshot(self):
        other = {'symbol': 'AAPL', 'currency': 'USD'}
        previous = {'demo': True, 'assets': [{**other, 'price': 999}]}
        result = build_snapshot([self.asset, other], [self.quote, {}], previous)
        self.assertIsNone(result['assets'][1]['price'])
        self.assertFalse(result['demo'])


if __name__ == '__main__':
    unittest.main()
