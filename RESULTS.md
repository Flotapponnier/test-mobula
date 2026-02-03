# Résultats Benchmark Mobula API

## 📊 Résultats (10 iterations)

### T1: Wallet Portfolio Snapshot
**Endpoint**: `/api/1/wallet/portfolio`

| Metric | Value |
|--------|-------|
| Min | 3,582ms |
| Average | **7,666ms** |
| P50 (Median) | 4,099ms |
| P95 | **15,325ms** |
| P99 | 15,325ms |
| Max | 15,325ms |
| StdDev | 4,697ms |
| Success Rate | 100% |

**⚠️ PROBLÈME DÉTECTÉ**:
- Latence moyenne de **7.7 secondes** (très lent)
- P95 à **15.3 secondes** (certaines requêtes prennent 15s+)
- Haute variabilité (StdDev: 4.7s)

---

### T4: Token Holders Snapshot
**Endpoint**: `/api/2/token/holder-positions`

| Metric | Value |
|--------|-------|
| Min | 66ms |
| Average | **589ms** |
| P50 (Median) | 90ms |
| P95 | **5,053ms** |
| P99 | 5,053ms |
| Max | 5,053ms |
| StdDev | 1,488ms |
| Success Rate | 100% |

**⚠️ PROBLÈME DÉTECTÉ**:
- Très haute variabilité (66ms → 5s)
- P95 à 5 secondes (outliers fréquents)
- Instabilité de performance

---

### T5: Token Price & Market Data
**Endpoint**: `/api/1/market/data`

| Metric | Value |
|--------|-------|
| Min | 42ms |
| Average | **69ms** |
| P50 (Median) | 47ms |
| P95 | 262ms |
| P99 | 262ms |
| Max | 262ms |
| StdDev | 64ms |
| Success Rate | 100% |

**✅ PERFORMANT**:
- Latence moyenne de 69ms (rapide)
- P95 acceptable (262ms)
- Relativement stable

---

## 🔍 Analyse Comparative

### Points Faibles vs Covalent:
1. **T1 Portfolio**: 7.7s moyenne vs probablement <1s pour Covalent
2. **T4 Holders**: Très instable (66ms → 5s)
3. **Variabilité**: Haute StdDev = performance imprévisible

### Points Forts:
1. **T5 Market Data**: Très rapide et stable
2. **Taux de succès**: 100% sur tous les tests
3. **Pas de timeouts**: Aucune requête n'a dépassé 30s

---

## 🎯 Recommandations

### Priorité 1: Optimiser T1 Portfolio
- Investiguer pourquoi certaines requêtes prennent 15+ secondes
- Ajouter du caching ou de l'indexing
- Paginer les résultats pour réduire la charge

### Priorité 2: Stabiliser T4 Holders
- Comprendre les outliers (5s vs 66ms)
- Optimiser les requêtes sur les gros tokens (USDC a millions de holders)
- Limiter les résultats par défaut

### Priorité 3: Validation supplémentaire
- Tester avec plus d'iterations (25-50)
- Tester d'autres wallets (pas seulement vitalik.eth)
- Tester d'autres tokens

---

## 📝 Méthodologie

Conforme au standard Covalent:
- ✅ 2 warm-up calls
- ✅ Server-side timing (performance.now)
- ✅ 30s timeout
- ✅ Exponential backoff (400ms base)
- ✅ Statistiques complètes (Min/Avg/P50/P95/P99/Max/StdDev)
- ✅ Mêmes adresses de test que Covalent

## 🔗 Test Addresses

- **Wallet**: vitalik.eth (`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`)
- **Token**: USDC Ethereum (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`)
- **Blockchain**: Ethereum (+ Base, Arbitrum pour portfolio)

---

## 🚀 Pour Aller Plus Loin

```bash
# Test rapide (5 iterations)
npm run test

# Test complet (10 iterations)
npm run benchmark

# Test approfondi (50 iterations)
npm run benchmark -- --iterations=50

# Test statistiquement significatif (100 iterations)
npm run benchmark -- --iterations=100
```

**Note**: Les résultats sont sauvegardés en JSON pour analyse ultérieure.
