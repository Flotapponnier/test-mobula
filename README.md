# Mobula API Benchmark

Benchmark Mobula API avec la méthodologie Covalent pour valider les performances.

## Tests Implémentés

### T1: Wallet Portfolio Snapshot
- Endpoint: `/api/1/wallet/portfolio`
- Test wallet: vitalik.eth (`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`)
- Mesure: Latence pour récupérer les balances + prix USD

### T4: Token Holders Snapshot
- Endpoint: `/api/2/token/holder-positions`
- Test token: USDC Ethereum (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`)
- Mesure: Latence pour récupérer 100 holders

### T5: Token Price & Market Data
- Endpoint: `/api/1/market/data`
- Test token: USDC Ethereum
- Mesure: Latence pour récupérer prix + market cap + volume

## Méthodologie

Conforme au benchmark Covalent:
- ✅ 2 warm-up calls (cold start elimination)
- ✅ Server-side high-resolution timing
- ✅ 30s timeout par requête
- ✅ Exponential backoff (400ms base, 4s max)
- ✅ Statistiques: Min, Avg, P50, P95, P99, Max, StdDev
- ✅ Pas de cache (requêtes fraîches)
- ✅ Adresses identiques à Covalent

## Installation

```bash
npm install
```

## Usage

```bash
# Benchmark par défaut (10 iterations)
npm run benchmark

# Test rapide (5 iterations)
npm run test

# Custom iterations
npm run benchmark -- --iterations=25
```

## Résultats

Les résultats sont sauvegardés dans `benchmark-results-{timestamp}.json` avec:
- Latences complètes
- Statistiques par test
- Taux de succès
- Erreurs et timeouts

## Comparaison avec Covalent

Une fois les tests exécutés, comparer les résultats Mobula vs Covalent GoldRush sur les mêmes métriques:
- Latence moyenne (Avg)
- P95/P99 (worst-case performance)
- Taux de succès
- Stabilité (StdDev)
