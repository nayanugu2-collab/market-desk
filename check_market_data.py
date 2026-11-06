import json
import math
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf


ASSETS = [
    ("005930.KS", "삼성전자", "KRW", "share"),
    ("AAPL", "Apple", "USD", "share"),
    ("069500.KS", "KODEX 200", "KRW", "share"),
    ("SPY", "SPY", "USD", "share"),
    ("QQQ", "QQQ", "USD", "share"),
    ("GC=F", "금 선물", "USD", "troy ounce"),
    ("CL=F", "WTI 선물", "USD", "barrel"),
    ("BZ=F", "Brent 선물", "USD", "barrel"),
]
def number(value):
    if value is None:
        return None
    result = float(value)
    return result if math.isfinite(result) else None
def inspect_asset(symbol, name, expected_currency, unit):
    result = {
        "symbol": symbol, "name": name, "expected_currency": expected_currency,
        "unit": unit, "status": "failed", "errors": [],
    }
    ticker = yf.Ticker(symbol)
    history = None
    try:
        history = ticker.history(
            period="1mo", interval="1d", auto_adjust=False,
            actions=False, timeout=20,
        )
        bars = history.dropna(subset=["Close"])
        result["daily_bars"] = len(bars)
        if not bars.empty:
            result["last_daily_bar"] = str(bars.index[-1])
            result["last_daily_close"] = number(bars["Close"].iloc[-1])
            result["previous_available_daily_close"] = (
                number(bars["Close"].iloc[-2]) if len(bars) > 1 else None
            )
    except Exception as exc:
        result["errors"].append(f"history: {type(exc).__name__}: {exc}")
    try:
        metadata = ticker.get_history_metadata() if history is not None else {}
        for key in ("currency", "exchangeName", "exchangeTimezoneName",
                    "instrumentType", "regularMarketPrice", "regularMarketTime"):
            result[key] = metadata.get(key)
        timestamp = metadata.get("regularMarketTime")
        if timestamp is not None:
            quote_time = (
                timestamp.astimezone(timezone.utc)
                if isinstance(timestamp, datetime)
                else datetime.fromtimestamp(timestamp, timezone.utc)
            )
            result["quote_time_utc"] = quote_time.isoformat()
            result["regularMarketTime"] = quote_time.isoformat()
        result["regularMarketPrice"] = number(result.get("regularMarketPrice"))
    except Exception as exc:
        result["errors"].append(f"metadata: {type(exc).__name__}: {exc}")
    result["currency_matches"] = result.get("currency") == expected_currency
    result["fetched_at_utc"] = datetime.now(timezone.utc).isoformat()
    if result.get("last_daily_close") is not None:
        result["status"] = "ok" if (
            result["currency_matches"] and result.get("quote_time_utc")
            and result.get("regularMarketPrice") is not None
        ) else "partial"
    return result


def main():
    yf.config.debug.hide_exceptions = False
    results = []
    for asset in ASSETS:
        print(f"Checking {asset[0]}...", flush=True)
        result = inspect_asset(*asset)
        results.append(result)
        print(f"  {result['status']}: {result.get('daily_bars', 0)} daily bars", flush=True)
    report = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "yfinance_version": yf.__version__,
        "notes": [
            "Live public requests; no mocks or paid credentials.",
            "Daily bars may include an unfinished session; not a live quote timestamp.",
            "Previous available daily close is not a validated quote comparison baseline.",
            "Futures contract month and real-time entitlement are not verified.",
            "ok means fields were retrieved, not freshness or continuous reliability.",
        ],
        "assets": results,
    }
    Path(__file__).with_name("market_data_results.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8"
    )
    print("Saved market_data_results.json", flush=True)
if __name__ == "__main__":
    main()
