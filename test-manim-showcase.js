#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function testManimShowcase() {
  console.log('🧪 Testing ManimShowcase compositions...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('❌ Console error:', msg.text());
    }
  });
  
  // Listen for page errors
  page.on('pageerror', error => {
    console.error('❌ Page error:', error.message);
  });
  
  const compositions = [
    { id: 'ManimShowcase-Gallery', name: 'Full Gallery' },
    { id: 'ManimShowcase-Geometry', name: 'Geometry Showcase' }
  ];
  
  let allPassed = true;
  
  for (const comp of compositions) {
    console.log(`\nTesting: ${comp.name} (${comp.id})`);
    console.log('─'.repeat(40));
    
    try {
      // Navigate to the composition
      await page.goto(`http://localhost:3001/${comp.id}`, { 
        waitUntil: 'networkidle2',
        timeout: 10000 
      });
      
      // Wait for the composition to render
      await page.waitForTimeout(2000);
      
      // Check if gallery is present
      const hasGallery = await page.evaluate(() => {
        const gallery = document.querySelector('[data-testid="manim-showcase"]');
        return gallery !== null;
      });
      
      // Check for video cards
      const videoCardCount = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-testid^="video-card"]');
        return cards.length;
      });
      
      // Check for search bar
      const hasSearch = await page.evaluate(() => {
        const search = document.querySelector('input[placeholder*="Search"]');
        return search !== null;
      });
      
      // Check for filter controls
      const hasFilters = await page.evaluate(() => {
        const filters = document.querySelector('[data-testid="filter-controls"]');
        return filters !== null;
      });
      
      // Report results
      console.log(`✅ Gallery rendered: ${hasGallery ? 'Yes' : 'No'}`);
      console.log(`✅ Video cards found: ${videoCardCount}`);
      console.log(`✅ Search bar present: ${hasSearch ? 'Yes' : 'No'}`);
      console.log(`✅ Filter controls present: ${hasFilters ? 'Yes' : 'No'}`);
      
      if (!hasGallery || videoCardCount === 0) {
        allPassed = false;
        console.log(`❌ ${comp.name} failed basic rendering tests`);
      } else {
        console.log(`✅ ${comp.name} passed all tests`);
      }
      
      // Take a screenshot for visual verification
      await page.screenshot({ 
        path: `manim-showcase-${comp.id}.png`,
        fullPage: true 
      });
      console.log(`📸 Screenshot saved: manim-showcase-${comp.id}.png`);
      
    } catch (error) {
      console.error(`❌ Error testing ${comp.name}:`, error.message);
      allPassed = false;
    }
  }
  
  await browser.close();
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All ManimShowcase tests passed!');
  } else {
    console.log('❌ Some tests failed. Check the output above.');
  }
  console.log('='.repeat(50));
  
  process.exit(allPassed ? 0 : 1);
}

testManimShowcase().catch(console.error);