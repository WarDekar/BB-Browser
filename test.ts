/**
 * Test script to verify BB-Browser functionality
 * Run with: npx tsx test.ts
 */

import { BrowserManager } from './src/index.js';

async function main() {
  console.log('🚀 Starting BB-Browser test...\n');

  const manager = new BrowserManager();

  // Listen for events
  manager.on('browser:created', (data) => console.log('  [event] Browser created:', data.name));
  manager.on('page:navigated', (data) => console.log('  [event] Page navigated:', data.url));
  manager.on('browser:closed', (data) => console.log('  [event] Browser closed:', data.name));

  try {
    // Test 1: Create a browser without proxy
    console.log('1. Creating browser instance (no proxy)...');
    const browser1 = await manager.create({
      name: 'test-browser',
      headless: false,
    });
    console.log('   ✓ Browser created:', browser1.getInfo());

    // Test 2: Navigate to a page
    console.log('\n2. Navigating to example.com...');
    const page = await browser1.goto('https://example.com');
    console.log('   ✓ Page title:', await page.title());

    // Test 3: Get page content
    console.log('\n3. Getting page content...');
    const text = await browser1.getTextContent();
    console.log('   ✓ Content preview:', text.slice(0, 100) + '...');

    // Test 4: List browsers
    console.log('\n4. Listing browsers...');
    const browsers = manager.list();
    console.log('   ✓ Running browsers:', browsers.map((b) => b.name));

    // Test 5: Save session
    console.log('\n5. Saving session...');
    await manager.saveSession('test-browser', 'example-session');
    console.log('   ✓ Session saved');

    // Test 6: List sessions
    console.log('\n6. Listing sessions...');
    const sessions = await manager.listSessions();
    console.log('   ✓ Saved sessions:', sessions);

    // Wait a moment to see the browser
    console.log('\n⏳ Waiting 3 seconds so you can see the browser...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Test 7: Close browser
    console.log('\n7. Closing browser...');
    await manager.close('test-browser');
    console.log('   ✓ Browser closed');

    // Test 8: Create new browser and load session
    console.log('\n8. Creating new browser and loading session...');
    const browser2 = await manager.createWithSession(
      { name: 'restored-browser', headless: false },
      'example-session'
    );
    console.log('   ✓ Browser with session loaded');
    console.log('   ✓ Current URL:', browser2.getCurrentPage()?.url());

    // Wait to see restored browser
    console.log('\n⏳ Waiting 3 seconds to see restored session...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Cleanup
    console.log('\n9. Cleaning up...');
    await manager.closeAll();
    await manager.deleteSession('example-session');
    console.log('   ✓ All cleaned up');

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await manager.closeAll();
    process.exit(1);
  }
}

main();
