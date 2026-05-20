import yfinance as yf
from datetime import datetime
import json
import os
import tempfile

# Constants
OUTPUT_FILE = 'public/data/market_snapshot.json'
MIN_REQUIRED_INDICES = 2

INDICES_MAP = {
    'NIFTY 50':   '^NSEI',
    'SENSEX':     '^BSESN',
    'NIFTY BANK': '^NSEBANK',
    'NIFTY IT':   '^CNXIT',
}

# Top NSE heavyweights for movers scan
STOCKS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
    'SBIN.NS', 'ITC.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS', 'LT.NS',
    'HINDUNILVR.NS', 'AXISBANK.NS', 'BAJFINANCE.NS', 'MARUTI.NS', 'WIPRO.NS',
]


def get_quote(ticker_symbol):
    """Return (price, change, change_pct) for a Yahoo Finance symbol."""
    tk = yf.Ticker(ticker_symbol)
    hist = tk.history(period='2d', interval='1d')
    if hist.empty or len(hist) < 1:
        return None
    close = hist['Close'].iloc[-1]
    prev  = hist['Close'].iloc[-2] if len(hist) >= 2 else close
    change     = close - prev
    change_pct = (change / prev * 100) if prev else 0.0
    return float(close), float(change), float(change_pct)


def read_existing_snapshot():
    if not os.path.exists(OUTPUT_FILE):
        return None
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        if len(existing.get('indices') or []) >= MIN_REQUIRED_INDICES:
            return existing
    except Exception as exc:
        print(f"[MarketSnapshot] Existing snapshot unreadable: {exc}")
    return None


def atomic_write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix='.market_snapshot.', suffix='.json', dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)
            f.write('\n')
        os.replace(tmp_path, path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def validate_snapshot(snapshot):
    indices = snapshot.get('indices') or []
    if len(indices) < MIN_REQUIRED_INDICES:
        raise ValueError(f"Market snapshot integrity failed: expected at least {MIN_REQUIRED_INDICES} indices, got {len(indices)}")


def fetch_market_snapshot():
    print("[MarketSnapshot] Starting fetch using yfinance...")

    snapshot = {
        "indices": [],
        "movers":  {"gainers": [], "losers": []},
        "generatedAt": datetime.utcnow().isoformat() + 'Z',
        "sourceHealth": {},
    }

    # 1. Fetch Indices
    for display_name, yf_symbol in INDICES_MAP.items():
        print(f"Fetching index {display_name} ({yf_symbol})...")
        try:
            result = get_quote(yf_symbol)
            if result is None:
                print(f"  No data for {display_name}")
                snapshot["sourceHealth"][display_name] = "empty"
                continue
            price, change, change_pct = result
            snapshot["indices"].append({
                "name":          display_name,
                "symbol":        yf_symbol,
                "value":         f"{price:.2f}",
                "change":        f"{change:.2f}",
                "changePercent": f"{change_pct:.2f}",
                "direction":     "up" if change >= 0 else "down",
            })
            snapshot["sourceHealth"][display_name] = "live"
            print(f"  {display_name}: {price:.2f} ({change_pct:+.2f}%)")
        except Exception as e:
            print(f"  Error fetching {display_name}: {e}")
            snapshot["sourceHealth"][display_name] = "failed"

    # 2. Fetch stock movers (top NSE heavyweights)
    stock_data = []
    for symbol in STOCKS:
        print(f"Fetching stock {symbol}...")
        try:
            result = get_quote(symbol)
            if result is None:
                continue
            price, change, change_pct = result
            display_symbol = symbol.replace('.NS', '').replace('.BO', '')
            stock_data.append({
                "symbol":        display_symbol,
                "price":         f"{price:.2f}",
                "change":        f"{change:.2f}",
                "changePercent": change_pct,
                "direction":     "up" if change >= 0 else "down",
            })
        except Exception as e:
            print(f"  Error fetching {symbol}: {e}")

    if stock_data:
        stock_data.sort(key=lambda x: float(x['changePercent']), reverse=True)
        gainers = [s for s in stock_data if float(s['changePercent']) > 0]
        losers  = [s for s in stock_data if float(s['changePercent']) < 0]
        losers.sort(key=lambda x: float(x['changePercent']))

        snapshot["movers"]["gainers"] = gainers[:5]
        snapshot["movers"]["losers"]  = losers[:5]

        for s in snapshot["movers"]["gainers"] + snapshot["movers"]["losers"]:
            s["changePercent"] = f"{s['changePercent']:.2f}"

    try:
        validate_snapshot(snapshot)
    except ValueError as exc:
        existing = read_existing_snapshot()
        if existing:
            existing["sourceHealth"] = existing.get("sourceHealth") or {}
            existing["sourceHealth"]["generator"] = "kept-last-good-after-empty-refresh"
            atomic_write_json(OUTPUT_FILE, existing)
            print(f"[MarketSnapshot] {exc}. Preserved last known good snapshot at {OUTPUT_FILE}.")
            return
        raise SystemExit(str(exc))

    atomic_write_json(OUTPUT_FILE, snapshot)

    print(f"[MarketSnapshot] Saved to {OUTPUT_FILE}")
    print(f"  Indices: {len(snapshot['indices'])}, "
          f"Gainers: {len(snapshot['movers']['gainers'])}, "
          f"Losers: {len(snapshot['movers']['losers'])}")


if __name__ == "__main__":
    fetch_market_snapshot()
