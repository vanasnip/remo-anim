import { test, expect, type Page } from '@playwright/test';

const DEPLOYED_URL = 'https://remotion-recovery.vercel.app';

test.describe('Debug Console Messages', () => {
  test('capture all console messages from deployed app', async ({ page }) => {
    const consoleMessages: Array<{ type: string, text: string, timestamp: number }> = [];
    
    // Capture ALL console messages
    page.on('console', msg => {
      const messageData = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleMessages.push(messageData);
      console.log(`[CONSOLE-${msg.type().toUpperCase()}] ${msg.text()}`);
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      console.log(`[PAGE-ERROR] ${error.message}`);
    });
    
    // Navigate to deployed app
    console.log(`\n🚀 Navigating to: ${DEPLOYED_URL}\n`);
    await page.goto(DEPLOYED_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for optimizations to initialize
    console.log('\n⏳ Waiting for optimizations to load...\n');
    await page.waitForTimeout(5000);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'verification-reports/console-debug.png',
      fullPage: true 
    });
    
    // Log all messages
    console.log('\n📋 ALL CONSOLE MESSAGES:');
    console.log('='.repeat(80));
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    console.log('='.repeat(80));
    
    // Check what production mode messages exist
    const productionMessages = consoleMessages.filter(msg => 
      msg.text.toLowerCase().includes('production') || 
      msg.text.toLowerCase().includes('performance') ||
      msg.text.includes('🚀') ||
      msg.text.includes('⚡')
    );
    
    console.log('\n🎯 PRODUCTION/PERFORMANCE MESSAGES:');
    productionMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type}] ${msg.text}`);
    });
    
    // Check for optimization keywords
    const optimizationKeywords = [
      'Service Worker',
      'Performance Observer', 
      'Resource Prefetching',
      'Image Optimization',
      'Memory Management',
      'Bundle Splitting',
      'CDN Preconnect',
      'Cache Management'
    ];
    
    console.log('\n🔍 OPTIMIZATION FEATURE CHECK:');
    optimizationKeywords.forEach(keyword => {
      const found = consoleMessages.some(msg => msg.text.includes(keyword));
      console.log(`${keyword}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    
    // Save debug info to file
    await page.evaluate((messages) => {
      console.log('🔍 DEBUG INFO SAVED:', {
        totalMessages: messages.length,
        messageTypes: [...new Set(messages.map(m => m.type))],
        hasProductionMode: messages.some(m => m.text.includes('🚀 Remotion Performance Mode')),
        hasOptimizations: messages.some(m => m.text.includes('⚡ Active Optimizations'))
      });
    }, consoleMessages);
    
    expect(consoleMessages.length).toBeGreaterThan(0);
  });
});