#!/usr/bin/env node

const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

async function testWebpackFix() {
  console.log("🔧 Testing webpack configuration fixes...\n");

  // Start Remotion dev server
  console.log("📦 Starting Remotion dev server...");
  const remotionProcess = spawn("npm", ["run", "dev"], {
    cwd: path.join(__dirname, "remotion-app"),
    stdio: ["pipe", "pipe", "pipe"],
    detached: false,
  });

  let serverReady = false;
  let serverError = null;

  // Monitor server output
  remotionProcess.stdout.on("data", (data) => {
    const output = data.toString();
    console.log("📊 Server:", output.trim());

    // Check for webpack override message
    if (output.includes("🔧 Applying webpack override")) {
      console.log("✅ Webpack override applied successfully!");
    }

    // Check for server ready
    if (output.includes("Ready") || output.includes("listening")) {
      serverReady = true;
    }
  });

  remotionProcess.stderr.on("data", (data) => {
    const error = data.toString();
    console.error("❌ Server Error:", error.trim());

    // Check for module resolution errors
    if (
      error.includes("Cannot find module") ||
      error.includes("Module not found")
    ) {
      serverError = error;
    }
  });

  // Wait for server to start
  console.log("⏳ Waiting for server to be ready...");
  await new Promise((resolve) => {
    const checkReady = setInterval(() => {
      if (serverReady || serverError) {
        clearInterval(checkReady);
        resolve();
      }
    }, 1000);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkReady);
      resolve();
    }, 30000);
  });

  if (serverError) {
    console.log("❌ Server failed to start due to module resolution errors:");
    console.log(serverError);
    remotionProcess.kill();
    return false;
  }

  if (!serverReady) {
    console.log("⚠️ Server did not become ready within timeout");
    remotionProcess.kill();
    return false;
  }

  // Test browser access
  console.log("🌐 Testing browser access...");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Listen for console errors
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
        console.log("🔴 Console Error:", msg.text());
      }
    });

    // Navigate to Remotion Studio
    console.log("📱 Loading Remotion Studio at http://localhost:3000...");
    await page.goto("http://localhost:3000", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Check for critical module errors
    const moduleErrors = consoleErrors.filter(
      (error) =>
        error.includes("Cannot find module") ||
        error.includes("Module not found") ||
        error.includes("path") ||
        error.includes("execa"),
    );

    if (moduleErrors.length > 0) {
      console.log("❌ Module resolution errors found:");
      moduleErrors.forEach((error) => console.log("  -", error));
      return false;
    }

    // Check if UI elements are visible
    const title = await page.title();
    console.log("📄 Page title:", title);

    const bodyContent = await page.$eval(
      "body",
      (el) => el.innerText.length > 0,
    );
    if (!bodyContent) {
      console.log("❌ Page appears to be blank - no content in body");
      return false;
    }

    console.log("✅ Remotion Studio loaded successfully!");
    console.log("✅ No module resolution errors detected");
    return true;
  } catch (error) {
    console.error("❌ Browser test failed:", error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
    remotionProcess.kill();
  }
}

// Run the test
testWebpackFix()
  .then((success) => {
    if (success) {
      console.log(
        "\n🎉 Webpack fix successful! Remotion app is working correctly.",
      );
      process.exit(0);
    } else {
      console.log("\n💥 Webpack fix failed. App still has bundling issues.");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("\n💥 Test execution failed:", error);
    process.exit(1);
  });
