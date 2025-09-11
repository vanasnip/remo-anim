import { test, expect, Page } from '@playwright/test';

/**
 * User Experience and Accessibility Test Suite
 * Tests navigation, responsive design, keyboard navigation, and accessibility features
 */

test.describe('User Experience and Accessibility Tests', () => {
  
  test('should test navigation between pages', async ({ page }) => {
    console.log('🔍 Testing navigation between pages...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Collect all navigation links
    const navLinks = await page.locator('nav a, .navigation a, .menu a, a[href^="/"]').all();
    const internalLinks: string[] = [];
    
    for (const link of navLinks.slice(0, 10)) { // Test first 10 links
      try {
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          internalLinks.push(`${href} (${text?.trim() || 'No text'})`);
        }
      } catch (e) {
        // Skip invalid links
      }
    }
    
    console.log(`🔗 Found ${internalLinks.length} navigation links:`);
    internalLinks.forEach((link, index) => {
      console.log(`   ${index + 1}. ${link}`);
    });
    
    // Test navigation functionality
    let navigationResults: any = {};
    
    for (let i = 0; i < Math.min(5, navLinks.length); i++) {
      try {
        const link = navLinks[i];
        const href = await link.getAttribute('href');
        const text = await link.textContent();
        
        if (href && href.startsWith('/')) {
          console.log(`   Testing navigation to: ${href}`);
          
          // Click the link
          await Promise.all([
            page.waitForLoadState('networkidle', { timeout: 15000 }),
            link.click()
          ]);
          
          // Check if navigation was successful
          const currentUrl = page.url();
          const wasSuccessful = currentUrl.includes(href) || currentUrl.endsWith(href);
          
          navigationResults[href] = {
            linkText: text?.trim() || 'No text',
            successful: wasSuccessful,
            finalUrl: currentUrl
          };
          
          if (wasSuccessful) {
            console.log(`   ✅ Successfully navigated to ${href}`);
          } else {
            console.log(`   ⚠️ Navigation to ${href} may have issues`);
          }
          
          // Go back to home for next test
          await page.goto('/', { waitUntil: 'networkidle' });
        }
      } catch (e) {
        console.log(`   ❌ Error testing navigation: ${e}`);
      }
    }
    
    // Save navigation results
    const fs = require('fs');
    if (!fs.existsSync('production-test-results/navigation')) {
      fs.mkdirSync('production-test-results/navigation', { recursive: true });
    }
    
    fs.writeFileSync(
      'production-test-results/navigation/navigation-test.json',
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalLinksFound: internalLinks.length,
        testedLinks: Object.keys(navigationResults).length,
        results: navigationResults
      }, null, 2)
    );
  });

  test('should check responsive design across breakpoints', async ({ page, isMobile }) => {
    console.log(`🔍 Testing responsive design (${isMobile ? 'Mobile' : 'Desktop'})...`);
    
    // Test different viewport sizes
    const viewports = isMobile 
      ? [
          { width: 320, height: 568, name: 'iPhone SE' },
          { width: 375, height: 667, name: 'iPhone 8' },
          { width: 414, height: 896, name: 'iPhone 11' }
        ]
      : [
          { width: 1024, height: 768, name: 'Tablet' },
          { width: 1366, height: 768, name: 'Laptop' },
          { width: 1920, height: 1080, name: 'Desktop' }
        ];
    
    for (const viewport of viewports) {
      console.log(`   Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      // Check for horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });
      
      if (hasHorizontalScroll) {
        console.log(`   ⚠️ Horizontal scroll detected on ${viewport.name}`);
      } else {
        console.log(`   ✅ No horizontal scroll on ${viewport.name}`);
      }
      
      // Check for mobile-friendly elements
      if (isMobile) {
        // Check touch target sizes
        const smallButtons = await page.locator('button, a, input').evaluateAll(elements => {
          return elements.filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44; // Apple HIG minimum
          }).length;
        });
        
        if (smallButtons > 0) {
          console.log(`   ⚠️ Found ${smallButtons} potentially too-small touch targets`);
        } else {
          console.log(`   ✅ Touch targets appear appropriately sized`);
        }
      }
      
      // Take screenshot for each viewport
      await page.screenshot({
        path: `production-test-results/screenshots/responsive-${viewport.name.toLowerCase().replace(' ', '-')}.png`,
        fullPage: true
      });
    }
  });

  test('should verify keyboard navigation', async ({ page }) => {
    console.log('🔍 Testing keyboard navigation...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Test tab navigation
    let tabStops = 0;
    let focusableElements: string[] = [];
    
    // Focus on body first
    await page.locator('body').focus();
    
    // Tab through the page
    for (let i = 0; i < 20; i++) { // Test first 20 tab stops
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        
        return {
          tagName: el.tagName,
          type: el.getAttribute('type'),
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          textContent: el.textContent?.slice(0, 50) || '',
          className: el.className,
          id: el.id
        };
      });
      
      if (focusedElement) {
        tabStops++;
        const elementDescription = `${focusedElement.tagName}${focusedElement.type ? `[type="${focusedElement.type}"]` : ''}${focusedElement.id ? `#${focusedElement.id}` : ''}`;
        focusableElements.push(elementDescription);
        
        // Check if element has visible focus indicator
        const hasFocusStyles = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          if (!el) return false;
          
          const styles = window.getComputedStyle(el);
          const pseudoStyles = window.getComputedStyle(el, ':focus');
          
          return (
            styles.outlineWidth !== '0px' ||
            styles.outlineStyle !== 'none' ||
            pseudoStyles.outlineWidth !== '0px' ||
            pseudoStyles.outlineStyle !== 'none' ||
            styles.boxShadow !== 'none' ||
            pseudoStyles.boxShadow !== 'none'
          );
        });
        
        if (!hasFocusStyles && i < 5) { // Only log first few for brevity
          console.log(`   ⚠️ Element may lack focus indicator: ${elementDescription}`);
        }
      } else {
        break; // No more focusable elements
      }
    }
    
    console.log(`⌨️ Keyboard navigation results:`);
    console.log(`   - Total tab stops found: ${tabStops}`);
    console.log(`   - Focusable elements: ${focusableElements.slice(0, 10).join(', ')}${focusableElements.length > 10 ? '...' : ''}`);
    
    if (tabStops > 0) {
      console.log('✅ Keyboard navigation is functional');
    } else {
      console.log('⚠️ No keyboard-accessible elements found');
    }
    
    // Test escape key functionality (if modals or overlays exist)
    const modalsOrOverlays = await page.locator('[role="dialog"], .modal, .overlay, .popup').count();
    if (modalsOrOverlays > 0) {
      console.log(`   Found ${modalsOrOverlays} potential modal/overlay elements`);
      await page.keyboard.press('Escape');
      console.log('   Tested Escape key functionality');
    }
    
    // Test Enter key on focusable elements
    if (focusableElements.length > 0) {
      await page.keyboard.press('Tab'); // Focus first element
      await page.keyboard.press('Enter');
      console.log('   Tested Enter key activation');
    }
  });

  test('should test accessibility features and ARIA compliance', async ({ page }) => {
    console.log('🔍 Testing accessibility features...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Check for proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    const headingLevels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(elements => {
      return elements.map(el => ({
        level: parseInt(el.tagName.charAt(1)),
        text: el.textContent?.slice(0, 50) || ''
      }));
    });
    
    console.log(`📋 Heading structure:`);
    headingLevels.forEach((heading, index) => {
      console.log(`   H${heading.level}: ${heading.text}`);
    });
    
    // Check for proper heading hierarchy
    let headingHierarchyValid = true;
    for (let i = 1; i < headingLevels.length; i++) {
      const currentLevel = headingLevels[i].level;
      const previousLevel = headingLevels[i - 1].level;
      if (currentLevel > previousLevel + 1) {
        headingHierarchyValid = false;
        console.log(`   ⚠️ Heading hierarchy skip detected: H${previousLevel} to H${currentLevel}`);
      }
    }
    
    if (headingHierarchyValid) {
      console.log('✅ Heading hierarchy appears valid');
    }
    
    // Check for alt text on images
    const images = await page.locator('img').count();
    const imagesWithAlt = await page.locator('img[alt]').count();
    const imagesWithEmptyAlt = await page.locator('img[alt=""]').count();
    const imagesWithoutAlt = images - imagesWithAlt;
    
    console.log(`🖼️ Image accessibility:`);
    console.log(`   - Total images: ${images}`);
    console.log(`   - Images with alt text: ${imagesWithAlt}`);
    console.log(`   - Images with empty alt: ${imagesWithEmptyAlt}`);
    console.log(`   - Images without alt: ${imagesWithoutAlt}`);
    
    if (imagesWithoutAlt > 0) {
      console.log(`   ⚠️ ${imagesWithoutAlt} images missing alt attributes`);
    } else {
      console.log('   ✅ All images have alt attributes');
    }
    
    // Check for ARIA labels and roles
    const ariaLabels = await page.locator('[aria-label]').count();
    const ariaRoles = await page.locator('[role]').count();
    const ariaDescribed = await page.locator('[aria-describedby]').count();
    const ariaExpanded = await page.locator('[aria-expanded]').count();
    
    console.log(`♿ ARIA attributes:`);
    console.log(`   - Elements with aria-label: ${ariaLabels}`);
    console.log(`   - Elements with role: ${ariaRoles}`);
    console.log(`   - Elements with aria-describedby: ${ariaDescribed}`);
    console.log(`   - Elements with aria-expanded: ${ariaExpanded}`);
    
    // Check for form accessibility
    const forms = await page.locator('form').count();
    const inputs = await page.locator('input, textarea, select').count();
    const labelsForInputs = await page.locator('label').count();
    const inputsWithLabels = await page.locator('input[id], textarea[id], select[id]').evaluateAll(elements => {
      return elements.filter(input => {
        const id = input.getAttribute('id');
        return id && document.querySelector(`label[for="${id}"]`);
      }).length;
    });
    
    if (forms > 0) {
      console.log(`📝 Form accessibility:`);
      console.log(`   - Forms: ${forms}`);
      console.log(`   - Input elements: ${inputs}`);
      console.log(`   - Labels: ${labelsForInputs}`);
      console.log(`   - Inputs with associated labels: ${inputsWithLabels}`);
      
      if (inputs > 0 && inputsWithLabels < inputs) {
        console.log(`   ⚠️ ${inputs - inputsWithLabels} inputs may lack proper labels`);
      }
    }
    
    // Check color contrast (basic check)
    const textElements = await page.locator('p, span, div, h1, h2, h3, h4, h5, h6, a, button').first();
    if (await textElements.count() > 0) {
      const contrastInfo = await textElements.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize
        };
      });
      
      console.log(`🎨 Sample text styling:`);
      console.log(`   - Color: ${contrastInfo.color}`);
      console.log(`   - Background: ${contrastInfo.backgroundColor}`);
      console.log(`   - Font size: ${contrastInfo.fontSize}`);
    }
    
    // Save accessibility report
    const fs = require('fs');
    if (!fs.existsSync('production-test-results/accessibility')) {
      fs.mkdirSync('production-test-results/accessibility', { recursive: true });
    }
    
    const accessibilityReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      headings: {
        total: headings.length,
        hierarchy: headingLevels,
        hierarchyValid: headingHierarchyValid
      },
      images: {
        total: images,
        withAlt: imagesWithAlt,
        withEmptyAlt: imagesWithEmptyAlt,
        withoutAlt: imagesWithoutAlt
      },
      aria: {
        elementsWithAriaLabel: ariaLabels,
        elementsWithRole: ariaRoles,
        elementsWithAriaDescribedBy: ariaDescribed,
        elementsWithAriaExpanded: ariaExpanded
      },
      forms: forms > 0 ? {
        totalForms: forms,
        totalInputs: inputs,
        totalLabels: labelsForInputs,
        inputsWithLabels: inputsWithLabels
      } : null
    };
    
    fs.writeFileSync(
      'production-test-results/accessibility/accessibility-report.json',
      JSON.stringify(accessibilityReport, null, 2)
    );
    
    console.log('✅ Accessibility report saved');
  });

  test('should test loading states and error handling', async ({ page }) => {
    console.log('🔍 Testing loading states and error handling...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Look for loading indicators
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '.loader',
      '[data-testid*="loading"]',
      '.skeleton',
      '.placeholder'
    ];
    
    let loadingIndicatorsFound = 0;
    for (const selector of loadingSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        loadingIndicatorsFound += count;
        console.log(`   Found loading indicator: ${selector} (${count} elements)`);
      }
    }
    
    console.log(`⏳ Loading indicators found: ${loadingIndicatorsFound}`);
    
    // Test error handling by trying to access invalid routes
    const invalidRoutes = ['/nonexistent', '/invalid-page', '/404-test'];
    
    for (const route of invalidRoutes) {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      const status = response?.status();
      
      console.log(`   Testing invalid route ${route}: ${status}`);
      
      if (status === 404) {
        // Look for proper 404 page
        const pageText = await page.textContent('body');
        const has404Content = pageText?.toLowerCase().includes('404') || 
                              pageText?.toLowerCase().includes('not found') ||
                              pageText?.toLowerCase().includes('page not found');
        
        if (has404Content) {
          console.log('   ✅ Proper 404 error page detected');
        } else {
          console.log('   ⚠️ 404 page may lack proper error messaging');
        }
      }
    }
    
    // Return to home page
    await page.goto('/', { waitUntil: 'networkidle' });
  });
  
  test.afterEach(async ({ page }) => {
    // Take final screenshot
    await page.screenshot({
      path: `production-test-results/screenshots/user-experience-final.png`,
      fullPage: true
    });
  });
});