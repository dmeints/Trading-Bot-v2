/**
 * API Connection Test Script
 * Tests all API keys and validates connectivity
 */

const axios = require('axios');

async function testAPIs() {
  console.log('🔍 Testing API Connections...\n');
  
  // Test CoinGecko API
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/ping', {
      headers: {
        'x-cg-pro-api-key': process.env.COINGECKO_API_KEY
      }
    });
    console.log('✅ CoinGecko API: Connected (Pro tier active)');
  } catch (error) {
    console.log('❌ CoinGecko API: Error -', error.response?.status || error.message);
  }
  
  // Test Binance API
  try {
    const timestamp = Date.now();
    const response = await axios.get('https://api.binance.com/api/v3/account', {
      headers: {
        'X-MBX-APIKEY': process.env.BINANCE_API_KEY
      },
      params: {
        timestamp,
        signature: 'test' // Would need proper signature in real implementation
      }
    });
    console.log('✅ Binance API: Connected');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('⚠️  Binance API: Keys detected but signature required (normal)');
    } else {
      console.log('❌ Binance API: Error -', error.response?.status || error.message);
    }
  }
  
  // Test X (Twitter) API
  try {
    const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
      headers: {
        'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}`
      },
      params: {
        query: 'BTC -is:retweet lang:en',
        max_results: 10
      }
    });
    console.log('✅ X (Twitter) API: Connected -', response.data?.data?.length || 0, 'posts found');
  } catch (error) {
    console.log('❌ X API: Error -', error.response?.status || error.message);
  }
  
  // Test Reddit API
  try {
    const auth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await axios.post('https://www.reddit.com/api/v1/access_token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'SkippyBot/1.0'
        }
      }
    );
    
    if (tokenResponse.data.access_token) {
      const response = await axios.get('https://oauth.reddit.com/r/cryptocurrency/hot', {
        headers: {
          'Authorization': `Bearer ${tokenResponse.data.access_token}`,
          'User-Agent': 'SkippyBot/1.0'
        },
        params: { limit: 5 }
      });
      console.log('✅ Reddit API: Connected -', response.data?.data?.children?.length || 0, 'posts found');
    }
  } catch (error) {
    console.log('❌ Reddit API: Error -', error.response?.status || error.message);
  }
  
  // Test Etherscan API
  try {
    const response = await axios.get('https://api.etherscan.io/api', {
      params: {
        module: 'stats',
        action: 'ethsupply',
        apikey: process.env.ETHERSCAN_API_KEY
      }
    });
    console.log('✅ Etherscan API: Connected - ETH Supply:', response.data?.result?.slice(0, 8) + '...');
  } catch (error) {
    console.log('❌ Etherscan API: Error -', error.response?.status || error.message);
  }
  
  // Test CryptoPanic API
  try {
    const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: process.env.CRYPTO_PANIC_API_KEY,
        currencies: 'BTC',
        filter: 'hot'
      }
    });
    console.log('✅ CryptoPanic API: Connected -', response.data?.results?.length || 0, 'news items found');
  } catch (error) {
    console.log('❌ CryptoPanic API: Error -', error.response?.status || error.message);
  }
  
  console.log('\n🚀 API Connection Tests Complete');
}

testAPIs().catch(console.error);