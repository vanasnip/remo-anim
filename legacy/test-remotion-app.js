const { chromium } = require("playwright");

async function testRemotionApp() {
  console.log("🎬 Starting Remotion App Testing...\n");

  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const testResults = {
    appLoaded: false,
    consoleErrors: [],
    consoleWarnings: [],
    compositions: {
      transitionShowcase: { visible: false, playable: false },
      videoEffects: { visible: false, playable: false },
    },
    overallStatus: "UNKNOWN",
  };

  // Collect console messages
  page.on("console", (msg) => {
    const msgType = msg.type();
    const text = msg.text();

    if (msgType === "error") {
      testResults.consoleErrors.push(text);
      console.log(`❌ Console Error: ${text}`);
    } else if (msgType === "warning") {
      testResults.consoleWarnings.push(text);
      console.log(`⚠️  Console Warning: ${text}`);
    }
  });

  // Catch page errors
  page.on("pageerror", (error) => {
    testResults.consoleErrors.push(error.message);
    console.log(`💥 Page Error: ${error.message}`);
  });

  try {
    console.log("🌐 Navigating to http://localhost:3000...");

    // Navigate to the app with timeout
    await page.goto("http://localhost:3000", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for the app to load
    console.log("⏳ Waiting for app to load...");
    await page.waitForTimeout(3000);

    // Check if main content is visible
    const titleElement = await page.$("text=Remotion Studio");
    if (titleElement) {
      testResults.appLoaded = true;
      console.log("✅ App loaded successfully!");
    } else {
      console.log(
        "❌ App title not found, checking for any Remotion content...",
      );
      // Alternative check for Remotion content
      const remotionContent = await page.$(
        '[data-testid="remotion-studio"], .remotion-studio, #root',
      );
      if (remotionContent) {
        testResults.appLoaded = true;
        console.log("✅ Remotion content detected!");
      }
    }

    console.log("\n🔍 Checking for compositions in sidebar...");

    // Wait for sidebar to load
    await page.waitForTimeout(2000);

    // Check for TransitionShowcase composition
    try {
      const transitionShowcase = await page
        .getByText("TransitionShowcase")
        .first();
      if (await transitionShowcase.isVisible()) {
        testResults.compositions.transitionShowcase.visible = true;
        console.log("✅ TransitionShowcase composition found!");

        // Try to click and test playability
        await transitionShowcase.click();
        await page.waitForTimeout(1000);

        // Look for play button or preview controls
        const playButton = await page.$(
          '[aria-label="Play"], [title="Play"], button:has-text("Play")',
        );
        if (playButton) {
          testResults.compositions.transitionShowcase.playable = true;
          console.log("✅ TransitionShowcase appears playable!");
        } else {
          console.log("⚠️  TransitionShowcase play controls not found");
        }
      }
    } catch (error) {
      console.log("❌ TransitionShowcase not found:", error.message);
    }

    // Check for VideoEffects composition
    try {
      const videoEffects = await page.getByText("VideoEffects").first();
      if (await videoEffects.isVisible()) {
        testResults.compositions.videoEffects.visible = true;
        console.log("✅ VideoEffects composition found!");

        // Try to click and test playability
        await videoEffects.click();
        await page.waitForTimeout(1000);

        // Look for play button or preview controls
        const playButton = await page.$(
          '[aria-label="Play"], [title="Play"], button:has-text("Play")',
        );
        if (playButton) {
          testResults.compositions.videoEffects.playable = true;
          console.log("✅ VideoEffects appears playable!");
        } else {
          console.log("⚠️  VideoEffects play controls not found");
        }
      }
    } catch (error) {
      console.log("❌ VideoEffects not found:", error.message);
    }

    // Take a screenshot for reference
    await page.screenshot({ path: "remotion-app-test.png", fullPage: true });
    console.log("📸 Screenshot saved as remotion-app-test.png");

    // Final assessment
    if (
      testResults.appLoaded &&
      testResults.consoleErrors.length === 0 &&
      (testResults.compositions.transitionShowcase.visible ||
        testResults.compositions.videoEffects.visible)
    ) {
      testResults.overallStatus = "EXCELLENT";
    } else if (
      testResults.appLoaded &&
      testResults.consoleErrors.length === 0
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
  } finally {
    // Keep browser open for manual inspection
    console.log("\n📋 COMPREHENSIVE TEST REPORT");
    console.log("=".repeat(50));
    console.log(`App Loaded: ${testResults.appLoaded ? "✅ YES" : "❌ NO"}`);
    console.log(`Console Errors: ${testResults.consoleErrors.length} found`);
    console.log(
      `Console Warnings: ${testResults.consoleWarnings.length} found`,
    );
    console.log(
      `TransitionShowcase: ${testResults.compositions.transitionShowcase.visible ? "✅ Visible" : "❌ Missing"} | ${testResults.compositions.transitionShowcase.playable ? "✅ Playable" : "⚠️ Not playable"}`,
    );
    console.log(
      `VideoEffects: ${testResults.compositions.videoEffects.visible ? "✅ Visible" : "❌ Missing"} | ${testResults.compositions.videoEffects.playable ? "✅ Playable" : "⚠️ Not playable"}`,
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

    console.log(
      "\n🔍 Browser left open for manual inspection. Close when done.",
    );
    console.log("Press Ctrl+C to exit and close browser.");

    // Wait for user input before closing
    process.stdin.resume();
    process.stdin.on("data", async () => {
      await browser.close();
      process.exit(0);
    });
  }
}

testRemotionApp().catch(console.error);
