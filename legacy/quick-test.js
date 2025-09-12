#!/usr/bin/env node

const http = require("http");

async function quickTest() {
  console.log("🔍 Quick test: Checking if Remotion server is responding...\n");

  return new Promise((resolve) => {
    const req = http.get("http://localhost:3001", (res) => {
      console.log(`✅ Server is responding with status: ${res.statusCode}`);

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (data.includes("DOCTYPE") || data.includes("<html")) {
          console.log("✅ Server is serving HTML content");
          console.log("✅ This suggests the webpack bundling is working!");
          resolve(true);
        } else {
          console.log("⚠️ Server response does not look like HTML");
          console.log("Response preview:", data.substring(0, 200));
          resolve(false);
        }
      });
    });

    req.on("error", (err) => {
      if (err.code === "ECONNREFUSED") {
        console.log("❌ No server running on port 3000");
        console.log("💡 Try running: cd remotion-app && npm run dev");
      } else {
        console.log("❌ Connection error:", err.message);
      }
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log("⏰ Request timed out");
      req.destroy();
      resolve(false);
    });
  });
}

quickTest().then((success) => {
  process.exit(success ? 0 : 1);
});
