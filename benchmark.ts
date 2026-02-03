#!/usr/bin/env tsx
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const MOBULA_API_KEY = process.env.MOBULA_API_KEY || '';
const COVALENT_API_KEY = process.env.COVALENT_API_KEY || '';
const CODEX_API_KEY = process.env.CODEX_API_KEY || '';
const TIMEOUT_MS = 30000; // 30 seconds
const WARMUP_CALLS = 2;
const DEFAULT_ITERATIONS = 10;

// Validate API keys
if (!MOBULA_API_KEY || !COVALENT_API_KEY || !CODEX_API_KEY) {
  console.error('❌ Error: Missing API keys!');
  console.error('Please create a .env file with:');
  console.error('  MOBULA_API_KEY=your_key');
  console.error('  COVALENT_API_KEY=your_key');
  console.error('  CODEX_API_KEY=your_key');
  console.error('\nSee .env.example for reference.');
  process.exit(1);
}

// Provider configurations
const PROVIDERS = {
  mobula: {
    name: 'Mobula',
    baseUrl: 'https://api.mobula.io/api',
    auth: (key: string) => ({ Authorization: key }),
    type: 'rest' as const,
  },
  covalent: {
    name: 'Covalent (GoldRush)',
    baseUrl: 'https://api.covalenthq.com',
    auth: (key: string) => ({ Authorization: `Basic ${Buffer.from(key + ':').toString('base64')}` }),
    type: 'rest' as const,
  },
  codex: {
    name: 'Codex',
    baseUrl: 'https://graph.codex.io/graphql',
    auth: (key: string) => ({ Authorization: key }),
    type: 'graphql' as const,
  },
};

// Test addresses (from Covalent methodology)
const TEST_ADDRESSES = {
  VITALIK: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  UNISWAP: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC',
  USDC_ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b1566dA3DFF',
  CIRCLE_TREASURY: '0x55FE002aefF02F77364de339a1292923A15844B8',
};

interface BenchmarkResult {
  latencies: number[];
  errors: number;
  timeouts: number;
}

interface Statistics {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
  errors: number;
  timeouts: number;
  successRate: number;
}

interface ProviderEndpoint {
  url: string;
  params: Record<string, any>;
  provider: keyof typeof PROVIDERS;
  apiKey: string;
  graphqlQuery?: string; // For GraphQL providers
}

// Calculate statistics from latencies
function calculateStats(result: BenchmarkResult, totalCalls: number): Statistics {
  const { latencies, errors, timeouts } = result;

  if (latencies.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      errors,
      timeouts,
      successRate: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;

  // Standard deviation
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    stdDev,
    errors,
    timeouts,
    successRate: (latencies.length / totalCalls) * 100,
  };
}

// Sleep with exponential backoff
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Make API call with timing (REST)
async function timedRestCall(
  url: string,
  params: Record<string, any>,
  headers: Record<string, string>,
  captureResponse: boolean = false
): Promise<{ latency: number | null; response?: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const start = performance.now();
    const result = await axios.get(url, {
      params,
      headers,
      signal: controller.signal,
      timeout: TIMEOUT_MS,
    });
    const end = performance.now();
    clearTimeout(timeoutId);
    return {
      latency: end - start,
      response: captureResponse ? result.data : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Handle rate limiting with exponential backoff
      if (axiosError.response?.status === 429) {
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '1', 10);
        const backoffMs = Math.min(retryAfter * 1000, 4000); // Max 4s
        await sleep(backoffMs);
        return { latency: null }; // Will retry
      }

      // Timeout
      if (axiosError.code === 'ECONNABORTED' || error.name === 'CanceledError') {
        return { latency: null };
      }
    }

    return { latency: null };
  }
}

// Make API call with timing (GraphQL)
async function timedGraphQLCall(
  url: string,
  query: string,
  headers: Record<string, string>,
  captureResponse: boolean = false
): Promise<{ latency: number | null; response?: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const start = performance.now();
    const result = await axios.post(
      url,
      { query },
      {
        headers,
        signal: controller.signal,
        timeout: TIMEOUT_MS,
      }
    );
    const end = performance.now();
    clearTimeout(timeoutId);
    return {
      latency: end - start,
      response: captureResponse ? result.data : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Debug logging
      if (captureResponse) {
        console.log('\n❌ GraphQL Error:', axiosError.message);
        if (axiosError.response) {
          console.log('Response status:', axiosError.response.status);
          console.log('Response data:', JSON.stringify(axiosError.response.data).substring(0, 500));
        }
      }

      // Handle rate limiting
      if (axiosError.response?.status === 429) {
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '1', 10);
        const backoffMs = Math.min(retryAfter * 1000, 4000);
        await sleep(backoffMs);
        return { latency: null };
      }

      // Timeout
      if (axiosError.code === 'ECONNABORTED' || error.name === 'CanceledError') {
        return { latency: null };
      }
    }

    return { latency: null };
  }
}

// Run benchmark for a single endpoint
async function runBenchmark(
  name: string,
  endpoint: ProviderEndpoint,
  iterations: number
): Promise<BenchmarkResult> {
  const provider = PROVIDERS[endpoint.provider];
  const authHeaders = provider.auth(endpoint.apiKey);
  const headers = {
    ...authHeaders,
    'Content-Type': 'application/json',
  };

  const result: BenchmarkResult = {
    latencies: [],
    errors: 0,
    timeouts: 0,
  };

  // Build full URL with params
  const queryString = Object.entries(endpoint.params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  const fullUrl = `${endpoint.url}?${queryString}`;

  console.log(`\n🔗 Provider: ${provider.name}`);
  console.log(`📍 Endpoint: ${endpoint.url}`);

  if (provider.type === 'graphql' && endpoint.graphqlQuery) {
    console.log(`📋 GraphQL Query:\n${endpoint.graphqlQuery}`);
    console.log(`\n💻 cURL Command:`);
    console.log(`curl -X POST "${endpoint.url}" \\`);
    Object.entries(headers).forEach(([key, value]) => {
      console.log(`  -H "${key}: ${value}" \\`);
    });
    console.log(`  -d '{"query":"${endpoint.graphqlQuery.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/"/g, '\\"')}"}'`);
  } else {
    console.log(`📋 Params: ${JSON.stringify(endpoint.params, null, 2)}`);
    console.log(`\n📡 Full URL:\n${fullUrl}`);
    console.log(`\n💻 cURL Command:`);
    console.log(`curl -X GET "${fullUrl}" \\`);
    Object.entries(headers).forEach(([key, value]) => {
      console.log(`  -H "${key}: ${value}" \\`);
    });
  }

  console.log(`\n🔄 ${name} - Warming up (${WARMUP_CALLS} calls)...`);

  // Warm-up calls
  for (let i = 0; i < WARMUP_CALLS; i++) {
    if (provider.type === 'graphql' && endpoint.graphqlQuery) {
      await timedGraphQLCall(endpoint.url, endpoint.graphqlQuery, headers, false);
    } else {
      await timedRestCall(endpoint.url, endpoint.params, headers, false);
    }
    await sleep(400); // Base backoff
  }

  console.log(`📊 ${name} - Running ${iterations} iterations...`);

  // Capture first response for display
  let sampleResponse: any = null;

  // Actual benchmark iterations
  for (let i = 0; i < iterations; i++) {
    const { latency, response } = provider.type === 'graphql' && endpoint.graphqlQuery
      ? await timedGraphQLCall(endpoint.url, endpoint.graphqlQuery, headers, i === 0)
      : await timedRestCall(endpoint.url, endpoint.params, headers, i === 0);

    if (i === 0 && response) {
      sampleResponse = response;
    }

    if (latency === null) {
      result.timeouts++;
    } else if (latency < 0) {
      result.errors++;
    } else {
      result.latencies.push(latency);
    }

    // Small delay between requests to avoid rate limiting
    if (i < iterations - 1) {
      await sleep(400);
    }

    // Progress indicator
    if ((i + 1) % 5 === 0 || i === iterations - 1) {
      process.stdout.write(`\r   Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log(''); // New line after progress

  // Display sample response
  if (sampleResponse) {
    console.log(`\n📦 Sample Response (first call):`);
    console.log(JSON.stringify(sampleResponse, null, 2).substring(0, 2000));
    if (JSON.stringify(sampleResponse).length > 2000) {
      console.log('... (truncated)');
    }
  }

  return result;
}

// Format statistics for display
function formatStats(stats: Statistics): string {
  return `
  ✅ Success Rate: ${stats.successRate.toFixed(1)}%
  ⚡ Min:     ${stats.min.toFixed(2)}ms
  📈 Avg:     ${stats.avg.toFixed(2)}ms
  📊 P50:     ${stats.p50.toFixed(2)}ms
  📊 P95:     ${stats.p95.toFixed(2)}ms
  📊 P99:     ${stats.p99.toFixed(2)}ms
  🔥 Max:     ${stats.max.toFixed(2)}ms
  📏 StdDev:  ${stats.stdDev.toFixed(2)}ms
  ❌ Errors:  ${stats.errors}
  ⏱️  Timeouts: ${stats.timeouts}
  `.trim();
}

// Main benchmark runner
async function main() {
  const args = process.argv.slice(2);
  const iterationsArg = args.find(arg => arg.startsWith('--iterations='));
  const iterations = iterationsArg
    ? parseInt(iterationsArg.split('=')[1], 10)
    : DEFAULT_ITERATIONS;

  const providerArg = args.find(arg => arg.startsWith('--provider='));
  const selectedProvider = providerArg?.split('=')[1] as keyof typeof PROVIDERS | 'all' || 'all';

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         MULTI-PROVIDER API BENCHMARK - Covalent Methodology   ║
╚═══════════════════════════════════════════════════════════════╝

Configuration:
  • Iterations: ${iterations}
  • Warm-up calls: ${WARMUP_CALLS}
  • Timeout: ${TIMEOUT_MS}ms
  • Providers: ${selectedProvider === 'all' ? 'Mobula + Covalent' : PROVIDERS[selectedProvider]?.name}
  • Test wallet: ${TEST_ADDRESSES.VITALIK}
  • Test token: USDC (${TEST_ADDRESSES.USDC_ETH})
  `);

  const results: Record<string, Statistics> = {};

  // Define endpoints for each provider
  const endpoints = {
    mobula: {
      t1: {
        url: `${PROVIDERS.mobula.baseUrl}/1/wallet/portfolio`,
        params: {
          wallet: TEST_ADDRESSES.VITALIK,
          blockchains: 'ethereum,base,arbitrum',
        },
        provider: 'mobula' as const,
        apiKey: MOBULA_API_KEY,
      },
      t2: {
        url: `${PROVIDERS.mobula.baseUrl}/1/wallet/trades`,
        params: {
          wallet: TEST_ADDRESSES.VITALIK,
          limit: 100,
        },
        provider: 'mobula' as const,
        apiKey: MOBULA_API_KEY,
      },
      t4: {
        url: `${PROVIDERS.mobula.baseUrl}/2/token/holder-positions`,
        params: {
          blockchain: 'ethereum',
          address: TEST_ADDRESSES.USDC_ETH,
          limit: 100,
        },
        provider: 'mobula' as const,
        apiKey: MOBULA_API_KEY,
      },
      t5: {
        url: `${PROVIDERS.mobula.baseUrl}/1/market/data`,
        params: {
          asset: TEST_ADDRESSES.USDC_ETH,
          blockchain: 'ethereum',
          shouldFetchPriceChange: '24h',
        },
        provider: 'mobula' as const,
        apiKey: MOBULA_API_KEY,
      },
    },
    covalent: {
      t1: {
        url: `${PROVIDERS.covalent.baseUrl}/v1/eth-mainnet/address/${TEST_ADDRESSES.VITALIK}/balances_v2/`,
        params: {},
        provider: 'covalent' as const,
        apiKey: COVALENT_API_KEY,
      },
      t2: {
        url: `${PROVIDERS.covalent.baseUrl}/v1/eth-mainnet/address/${TEST_ADDRESSES.VITALIK}/transactions_v3/`,
        params: {
          'page-size': 100,
        },
        provider: 'covalent' as const,
        apiKey: COVALENT_API_KEY,
      },
      t4: {
        url: `${PROVIDERS.covalent.baseUrl}/v1/eth-mainnet/tokens/${TEST_ADDRESSES.USDC_ETH}/token_holders_v2/`,
        params: {
          'page-size': 100,
        },
        provider: 'covalent' as const,
        apiKey: COVALENT_API_KEY,
      },
      t5: {
        url: `${PROVIDERS.covalent.baseUrl}/v1/pricing/historical_by_addresses_v2/eth-mainnet/usd/${TEST_ADDRESSES.USDC_ETH}/`,
        params: {},
        provider: 'covalent' as const,
        apiKey: COVALENT_API_KEY,
      },
    },
    codex: {
      t1: null, // Codex doesn't support wallet portfolio
      t2: null, // Codex doesn't support wallet transactions
      t4: null, // Codex doesn't support token holders
      t5: {
        url: PROVIDERS.codex.baseUrl,
        params: {},
        provider: 'codex' as const,
        apiKey: CODEX_API_KEY,
        graphqlQuery: `query { getTokenPrices(inputs: [{ address: "${TEST_ADDRESSES.USDC_ETH}", networkId: 1 }]) { address networkId priceUsd timestamp } }`,
      },
    },
  };

  const providersToTest = selectedProvider === 'all'
    ? (['mobula', 'covalent', 'codex'] as const)
    : [selectedProvider as keyof typeof endpoints];

  // Run benchmarks for each provider
  for (const provider of providersToTest) {
    console.log(`\n\n╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║  ${PROVIDERS[provider].name.toUpperCase().padEnd(60)} ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝`);

    // T1: Wallet Portfolio Snapshot
    if (endpoints[provider].t1) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('  T1: WALLET PORTFOLIO SNAPSHOT');
      console.log('═══════════════════════════════════════════════════════════════');

      const t1Result = await runBenchmark(
        `T1 - Portfolio (vitalik.eth)`,
        endpoints[provider].t1,
        iterations
      );
      results[`${provider}_T1_Portfolio`] = calculateStats(t1Result, iterations);
      console.log(formatStats(results[`${provider}_T1_Portfolio`]));
    } else {
      console.log('\n⚠️  T1: WALLET PORTFOLIO SNAPSHOT - Not supported by ' + PROVIDERS[provider].name);
    }

    // T2: Wallet Transfer Feed
    if (endpoints[provider].t2) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('  T2: WALLET TRANSFER FEED');
      console.log('═══════════════════════════════════════════════════════════════');

      const t2Result = await runBenchmark(
        `T2 - Transfers (vitalik.eth)`,
        endpoints[provider].t2,
        iterations
      );
      results[`${provider}_T2_Transfers`] = calculateStats(t2Result, iterations);
      console.log(formatStats(results[`${provider}_T2_Transfers`]));
    } else {
      console.log('\n⚠️  T2: WALLET TRANSFER FEED - Not supported by ' + PROVIDERS[provider].name);
    }

    // T4: Token Holders Snapshot
    if (endpoints[provider].t4) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('  T4: TOKEN HOLDERS SNAPSHOT');
      console.log('═══════════════════════════════════════════════════════════════');

      const t4Result = await runBenchmark(
        `T4 - Holders (USDC)`,
        endpoints[provider].t4,
        iterations
      );
      results[`${provider}_T4_Holders`] = calculateStats(t4Result, iterations);
      console.log(formatStats(results[`${provider}_T4_Holders`]));
    } else {
      console.log('\n⚠️  T4: TOKEN HOLDERS SNAPSHOT - Not supported by ' + PROVIDERS[provider].name);
    }

    // T5: Token Price & Market Data
    if (endpoints[provider].t5) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('  T5: TOKEN PRICE & MARKET DATA');
      console.log('═══════════════════════════════════════════════════════════════');

      const t5Result = await runBenchmark(
        `T5 - Market Data (USDC)`,
        endpoints[provider].t5,
        iterations
      );
      results[`${provider}_T5_MarketData`] = calculateStats(t5Result, iterations);
      console.log(formatStats(results[`${provider}_T5_MarketData`]));
    } else {
      console.log('\n⚠️  T5: TOKEN PRICE & MARKET DATA - Not supported by ' + PROVIDERS[provider].name);
    }
  }

  // Summary table
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  📊 COMPARATIVE SUMMARY - ALL PROVIDERS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Provider + Test        | Min    | Avg    | P50    | P95    | P99    | Max    | Success');
  console.log('-----------------------|--------|--------|--------|--------|--------|--------|--------');

  Object.entries(results).forEach(([name, stats]) => {
    const label = name.padEnd(22);
    const min = `${stats.min.toFixed(0)}ms`.padEnd(6);
    const avg = `${stats.avg.toFixed(0)}ms`.padEnd(6);
    const p50 = `${stats.p50.toFixed(0)}ms`.padEnd(6);
    const p95 = `${stats.p95.toFixed(0)}ms`.padEnd(6);
    const p99 = `${stats.p99.toFixed(0)}ms`.padEnd(6);
    const max = `${stats.max.toFixed(0)}ms`.padEnd(6);
    const success = `${stats.successRate.toFixed(1)}%`;

    console.log(`${label} | ${min} | ${avg} | ${p50} | ${p95} | ${p99} | ${max} | ${success}`);
  });

  // Comparison analysis (if both providers tested)
  if (providersToTest.length === 2) {
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  🔬 COMPARATIVE ANALYSIS (Avg Latency)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    ['T1_Portfolio', 'T2_Transfers', 'T4_Holders', 'T5_MarketData'].forEach(test => {
      const mobulaKey = `mobula_${test}`;
      const covalentKey = `covalent_${test}`;

      if (results[mobulaKey] && results[covalentKey]) {
        const mobulaAvg = results[mobulaKey].avg;
        const covalentAvg = results[covalentKey].avg;
        const diff = mobulaAvg - covalentAvg;
        const percentDiff = ((diff / covalentAvg) * 100).toFixed(1);
        const winner = diff < 0 ? '🏆 Mobula' : '🏆 Covalent';
        const diffSign = diff > 0 ? '+' : '';

        console.log(`${test}:`);
        console.log(`  Mobula:   ${mobulaAvg.toFixed(0)}ms`);
        console.log(`  Covalent: ${covalentAvg.toFixed(0)}ms`);
        console.log(`  Diff:     ${diffSign}${diff.toFixed(0)}ms (${diffSign}${percentDiff}%)`);
        console.log(`  Winner:   ${winner}\n`);
      }
    });
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Export results as JSON
  const timestamp = new Date().toISOString();
  const exportData = {
    timestamp,
    iterations,
    warmupCalls: WARMUP_CALLS,
    timeout: TIMEOUT_MS,
    testAddresses: TEST_ADDRESSES,
    results,
  };

  const fs = require('fs');
  const outputFile = `benchmark-results-${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));

  console.log(`💾 Results saved to: ${outputFile}\n`);
}

// Run
main().catch(console.error);
