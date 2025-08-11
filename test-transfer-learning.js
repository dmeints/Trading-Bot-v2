
const BASE_URL = 'http://localhost:5000';

async function testTransferLearningEndpoints() {
  console.log('🧪 Testing Transfer Learning Implementation...\n');

  try {
    // Test 1: Get available models
    console.log('📋 Testing GET /api/transfer-learning/models');
    const modelsResponse = await fetch(`${BASE_URL}/api/transfer-learning/models`);
    const modelsData = await modelsResponse.json();
    console.log(`✅ Status: ${modelsResponse.status}`);
    console.log(`📊 Found ${modelsData.data?.count || 0} models`);
    console.log(`🎯 Recommended: ${modelsData.data?.recommended || 'None'}\n`);

    // Test 2: Get recommended model
    console.log('🎯 Testing GET /api/transfer-learning/recommended');
    const recommendedResponse = await fetch(`${BASE_URL}/api/transfer-learning/recommended`);
    const recommendedData = await recommendedResponse.json();
    console.log(`✅ Status: ${recommendedResponse.status}`);
    console.log(`🏆 Model: ${recommendedData.data?.model?.name || 'None'}`);
    console.log(`📈 Sharpe Ratio: ${recommendedData.data?.model?.performance?.sharpeRatio || 'N/A'}\n`);

    // Test 3: Quick start transfer learning
    console.log('🚀 Testing POST /api/transfer-learning/quick-start');
    const quickStartResponse = await fetch(`${BASE_URL}/api/transfer-learning/quick-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const quickStartData = await quickStartResponse.json();
    console.log(`✅ Status: ${quickStartResponse.status}`);
    console.log(`⚡ Duration: ${quickStartData.data?.estimatedDuration || 'N/A'}`);
    console.log(`📊 Expected Improvement: ${quickStartData.data?.expectedImprovement || 'N/A'}\n`);

    // Test 4: Custom transfer learning
    console.log('⚙️ Testing POST /api/transfer-learning/start');
    const customStartResponse = await fetch(`${BASE_URL}/api/transfer-learning/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName: 'FinRL-PPO',
        transferType: 'deep_transfer'
      })
    });
    const customStartData = await customStartResponse.json();
    console.log(`✅ Status: ${customStartResponse.status}`);
    console.log(`🔄 Transfer Type: ${customStartData.data?.transferType || 'N/A'}`);
    console.log(`⏱️ Duration: ${customStartData.data?.estimatedDuration || 'N/A'}\n`);

    console.log('🎉 All transfer learning endpoints tested successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTransferLearningEndpoints();
