/**
 * Test script for the Enhanced Web Scraping API
 * Run this script to test the API endpoints
 */

const testUrls = {
  simple: 'https://example.com',
  news: 'https://www.bbc.com/news',
  tech: 'https://techcrunch.com'
};

const API_BASE = 'http://localhost:6677/api/v2';

// Test Enhanced Scraping
async function testEnhancedScraping() {
  console.log('\n🚀 Testing Enhanced Scraping...');
  
  try {
    const response = await fetch(`${API_BASE}/scrape-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUrl: testUrls.simple,
        includeLinks: true,
        includeImages: false
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Enhanced scraping successful!');
      console.log(`📄 Title: ${data.data.title}`);
      console.log(`📊 Stats: ${data.stats.headings} headings, ${data.stats.paragraphs} paragraphs`);
      console.log(`🔗 Links found: ${data.stats.links}`);
    } else {
      console.log('❌ Enhanced scraping failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

// Test Lightweight Scraping
async function testLightweightScraping() {
  console.log('\n⚡ Testing Lightweight Scraping...');
  
  try {
    const response = await fetch(`${API_BASE}/scrape-lightweight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUrl: testUrls.simple,
        includeLinks: false
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Lightweight scraping successful!');
      console.log(`📄 Title: ${data.data.title}`);
      console.log(`📊 Content items: ${data.stats.contentItems}`);
      console.log(`📝 First content item: ${data.data.content[0]?.text?.substring(0, 100)}...`);
    } else {
      console.log('❌ Lightweight scraping failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

// Test Batch Scraping
async function testBatchScraping() {
  console.log('\n📦 Testing Batch Scraping...');
  
  try {
    const response = await fetch(`${API_BASE}/scrape-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [testUrls.simple, 'https://httpbin.org/html'],
        includeLinks: false,
        includeImages: false
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Batch scraping successful!');
      console.log(`📊 Results: ${data.stats.successful}/${data.stats.total} successful`);
      
      data.results.forEach((result, index) => {
        if (result.success) {
          console.log(`  ${index + 1}. ✅ ${result.url} - ${result.data.title}`);
        } else {
          console.log(`  ${index + 1}. ❌ ${result.url} - ${result.error}`);
        }
      });
    } else {
      console.log('❌ Batch scraping failed:', data.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

// Test Health Check
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    console.log('✅ Health check successful!');
    console.log(`📡 Status: ${data.status}`);
    console.log(`📋 Available endpoints: ${data.endpoints.length}`);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 Starting API Tests...');
  console.log('=' .repeat(50));
  
  await testHealthCheck();
  await testEnhancedScraping();
  await testLightweightScraping();
  await testBatchScraping();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 All tests completed!');
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export {
  testEnhancedScraping,
  testLightweightScraping,
  testBatchScraping,
  testHealthCheck,
  runAllTests
};
