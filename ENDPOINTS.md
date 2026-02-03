# Endpoints Testés - Mobula API Benchmark

## 🔗 URLs Complètes des Endpoints

### Base URLs
- **Production**: `https://api.mobula.io/api`
- **Demo**: `https://demo-api.mobula.io/api`

---

## T1: Wallet Portfolio Snapshot

### Endpoint
```
GET /1/wallet/portfolio
```

### URL Complète Testée
```
https://api.mobula.io/api/1/wallet/portfolio?wallet=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&blockchains=ethereum,base,arbitrum
```

### Paramètres
| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `wallet` | `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` | vitalik.eth wallet address |
| `blockchains` | `ethereum,base,arbitrum` | Chains à interroger |

### Exemple cURL
```bash
curl -X GET "https://api.mobula.io/api/1/wallet/portfolio?wallet=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&blockchains=ethereum,base,arbitrum" \
  -H "Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00"
```

### Réponse Attendue
- Balances de tous les tokens
- Prix USD en temps réel
- Metadata des tokens
- Cross-chain aggregation

---

## T4: Token Holders Snapshot

### Endpoint
```
GET /2/token/holder-positions
```

### URL Complète Testée
```
https://api.mobula.io/api/2/token/holder-positions?blockchain=ethereum&address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&limit=100
```

### Paramètres
| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `blockchain` | `ethereum` | Blockchain name |
| `address` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token contract |
| `limit` | `100` | Max holders retournés |

### Exemple cURL
```bash
curl -X GET "https://api.mobula.io/api/2/token/holder-positions?blockchain=ethereum&address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&limit=100" \
  -H "Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00"
```

### Réponse Attendue
- Liste des 100 premiers holders
- Balances par holder
- Pourcentage du total supply
- Labels (sniper, insider, etc.)
- PnL par holder

---

## T5: Token Price & Market Data

### Endpoint
```
GET /1/market/data
```

### URL Complète Testée
```
https://api.mobula.io/api/1/market/data?asset=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&blockchain=ethereum&shouldFetchPriceChange=24h
```

### Paramètres
| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `asset` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | USDC token contract |
| `blockchain` | `ethereum` | Blockchain name |
| `shouldFetchPriceChange` | `24h` | Timeframe for price change |

### Exemple cURL
```bash
curl -X GET "https://api.mobula.io/api/1/market/data?asset=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&blockchain=ethereum&shouldFetchPriceChange=24h" \
  -H "Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00"
```

### Réponse Attendue
- Prix actuel
- Market cap
- Volume 24h
- Price changes (1h, 24h, 7d, 1m, 1y)
- Liquidité
- Supply details

---

## 🔑 Authentication

Tous les endpoints utilisent la même API key dans le header:

```
Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00
```

---

## 📊 Test Addresses Summary

```javascript
const TEST_ADDRESSES = {
  // Wallets
  VITALIK: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  UNISWAP: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC',

  // Tokens
  USDC_ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b1566dA3DFF',

  // Holders
  CIRCLE_TREASURY: '0x55FE002aefF02F77364de339a1292923A15844B8',
};
```

---

## ⚙️ Configuration Benchmark

| Paramètre | Valeur |
|-----------|--------|
| **Timeout** | 30,000ms (30s) |
| **Warm-up calls** | 2 |
| **Default iterations** | 10 |
| **Rate limit backoff** | 400ms base, 4s max |
| **Timing method** | Server-side (performance.now) |

---

## 🧪 Tester Manuellement

### Quick Test T1 (Portfolio)
```bash
curl -X GET "https://api.mobula.io/api/1/wallet/portfolio?wallet=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&blockchains=ethereum" \
  -H "Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00" \
  -w "\nTime: %{time_total}s\n"
```

### Quick Test T4 (Holders)
```bash
curl -X GET "https://api.mobula.io/api/2/token/holder-positions?blockchain=ethereum&address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&limit=10" \
  -H "Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00" \
  -w "\nTime: %{time_total}s\n"
```

### Quick Test T5 (Market Data)
```bash
curl -X GET "https://api.mobula.io/api/1/market/data?asset=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&blockchain=ethereum&shouldFetchPriceChange=24h" \
  -H "Authorization: 886fb20c-17ea-42ea-b09a-9cde244cdf00" \
  -w "\nTime: %{time_total}s\n"
```

---

## 📖 Documentation Officielle

- Portfolio: https://docs.mobula.io/rest-api-reference/endpoint/wallet-portfolio
- Holders: https://docs.mobula.io/rest-api-reference/endpoint/token-holder-positions
- Market Data: https://docs.mobula.io/rest-api-reference/endpoint/market-data
