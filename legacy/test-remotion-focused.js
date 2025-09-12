const { chromium } = require("playwright");

async function testRemotionFocused() {
  console.log("🎬 Starting Focused Remotion App Test...\n");

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const testResults = {
    appLoaded: false,
    consoleErrors: [],
    consoleWarnings: [],
    compositions: {
      transitionShowcase: { visible: false, playable: false },
      videoEffects: { visible: false, playable: false },
      allFound: [],
    },
    overallStatus: "UNKNOWN",
  };

  // Collect console messages
  page.on("console", (msg) => {
    const msgType = msg.type();
    const text = msg.text();
    console.log(`[CONSOLE ${msgType.toUpperCase()}]: ${text}`);

    if (msgType === "error") {
      testResults.consoleErrors.push(text);
    } else if (msgType === "warning") {
      testResults.consoleWarnings.push(text);
    }
  });

  // Catch page errors
  page.on("pageerror", (error) => {
    testResults.consoleErrors.push(error.message);
    console.log(`💥 Page Error: ${error.message}`);
  });

  try {
    console.log("🌐 Navigating to http://localhost:3000...");

    await page.goto("http://localhost:3000", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    console.log("⏳ Waiting for Remotion Studio to fully load (20 seconds)...");
    await page.waitForTimeout(20000);

    // Try to find the Remotion Studio elements
    console.log("🔍 Looking for Remotion Studio elements...");

    // Check for various possible selectors that might indicate the app loaded
    const studioSelectors = [
      "text=Remotion Studio",
      '[data-testid="remotion-studio"]',
      ".remotion-studio",
      "#__remotion-studio-container",
      "text=HelloWorld",
      "text=TransitionShowcase",
      "text=VideoEffects",
      '[aria-label="Composition"]',
      'button[role="button"]',
    ];

    for (const selector of studioSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found element with selector: ${selector}`);
          testResults.appLoaded = true;
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

    // Get all text content from the page to analyze
    const bodyText = await page.textContent("body");
    console.log(
      `\n📄 Page text content (first 500 chars):\n${bodyText.slice(0, 500)}...\n`,
    );

    // Look for compositions in the text
    const compositionNames = [
      "HelloWorld",
      "TransitionShowcase",
      "VideoEffects",
      "ProductPromo",
      "MathLesson",
    ];
    compositionNames.forEach((comp) => {
      if (bodyText.includes(comp)) {
        testResults.compositions.allFound.push(comp);
        console.log(`✅ Found composition: ${comp}`);

        if (comp === "TransitionShowcase") {
          testResults.compositions.transitionShowcase.visible = true;
        }
        if (comp === "VideoEffects") {
          testResults.compositions.videoEffects.visible = true;
        }
      }
    });

    // Take a screenshot
    await page.screenshot({
      path: "remotion-focused-test.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved as remotion-focused-test.png");

    // Try to interact with compositions if found
    if (testResults.compositions.transitionShowcase.visible) {
      try {
        console.log("🎯 Trying to click TransitionShowcase...");
        await page.click("text=TransitionShowcase");
        await page.waitForTimeout(2000);
        testResults.compositions.transitionShowcase.playable = true;
        console.log("✅ TransitionShowcase clickable!");
      } catch (e) {
        console.log(
          "⚠️  Could not interact with TransitionShowcase:",
          e.message,
        );
      }
    }

    if (testResults.compositions.videoEffects.visible) {
      try {
        console.log("🎯 Trying to click VideoEffects...");
        await page.click("text=VideoEffects");
        await page.waitForTimeout(2000);
        testResults.compositions.videoEffects.playable = true;
        console.log("✅ VideoEffects clickable!");
      } catch (e) {
        console.log("⚠️  Could not interact with VideoEffects:", e.message);
      }
    }

    // Final assessment
    if (
      testResults.appLoaded &&
      testResults.compositions.allFound.length > 0 &&
      testResults.consoleErrors.length === 0
    ) {
      testResults.overallStatus = "EXCELLENT";
    } else if (
      testResults.appLoaded &&
      testResults.compositions.allFound.length > 0
    ) {
      testResults.overallStatus = "GOOD";
    } else if (testResults.appLoaded) {
      testResults.overallStatus = "FAIR";
    } else {
      testResults.overallStatus = "POOR";
    }
  } catch (error) {
    console.log("💥 Test failed with error:", error.message);
    testResults.overallStatus = "FAILED";
  }

  // Generate final report
  console.log("\n" + "=".repeat(60));
  console.log("📋 COMPREHENSIVE REMOTION APP TEST REPORT");
  console.log("=".repeat(60));
  console.log(`App Loaded: ${testResults.appLoaded ? "✅ YES" : "❌ NO"}`);
  console.log(`Console Errors: ${testResults.consoleErrors.length} found`);
  console.log(`Console Warnings: ${testResults.consoleWarnings.length} found`);
  console.log(
    `Compositions Found: ${testResults.compositions.allFound.length} (${testResults.compositions.allFound.join(", ")})`,
  );
  console.log(
    `TransitionShowcase: ${testResults.compositions.transitionShowcase.visible ? "✅ Visible" : "❌ Missing"} | ${testResults.compositions.transitionShowcase.playable ? "✅ Interactive" : "⚠️ Not interactive"}`,
  );
  console.log(
    `VideoEffects: ${testResults.compositions.videoEffects.visible ? "✅ Visible" : "❌ Missing"} | ${testResults.compositions.videoEffects.playable ? "✅ Interactive" : "⚠️ Not interactive"}`,
  );
  console.log(`Overall Status: ${testResults.overallStatus}`);

  if (testResults.consoleErrors.length > 0) {
    console.log("\n🚨 CONSOLE ERRORS DETECTED:");
    testResults.consoleErrors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  if (testResults.consoleWarnings.length > 0) {
    console.log("\n⚠️  CONSOLE WARNINGS DETECTED:");
    testResults.consoleWarnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }

  console.log("\n🔍 Browser remains open for manual inspection.");
  console.log("Press Enter to close browser and exit...");

  // Wait for user input before closing
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
  });

  await browser.close();
  return testResults;
}

testRemotionFocused().catch(console.error);
