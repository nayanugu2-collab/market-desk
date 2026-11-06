import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_market_data import inspect_asset

ROOT = Path(__file__).resolve().parents[1]


def merge_asset(asset, result, previous=None):
    price = result.get('regularMarketPrice')
    good = (
        result.get('currency_matches') and isinstance(price, (float, int))
        and math.isfinite(price) and result.get('quote_time_utc')
    )
    if good:
        return {**asset, 'price': price, 'quote_at': result['quote_time_utc'],
                'fetched_at': result['fetched_at_utc'], 'status': 'ok'}
    if previous and previous.get('price') is not None:
        return {**previous, **asset, 'status': 'stale'}
    return {**asset, 'price': None, 'quote_at': None, 'fetched_at': None, 'status': 'failed'}


def build_snapshot(catalog, results, previous):
    old = {} if previous.get('demo') else {a['symbol']: a for a in previous.get('assets', [])}
    rows = [merge_asset(a, r, old.get(a['symbol'])) for a, r in zip(catalog, results, strict=True)]
    if not any(a['status'] == 'ok' for a in rows):
        raise RuntimeError('All quotes failed; preserving the previous snapshot')
    return {'version': 1, 'demo': False, 'collected_at': datetime.now(timezone.utc).isoformat(), 'assets': rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'data/market.json')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'data/catalog.json').read_text(encoding='utf-8'))
    previous = json.loads(args.output.read_text(encoding='utf-8')) if args.output.exists() else {}
    results = []
    for asset in catalog:
        print('Collecting', asset['symbol'], flush=True)
        results.append(inspect_asset(asset['symbol'], asset['name'], asset['currency'], asset['unit']))
    snapshot = build_snapshot(catalog, results, previous)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    temporary.replace(args.output)
    print('Saved', args.output)


if __name__ == '__main__':
    main()
