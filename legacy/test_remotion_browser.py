#!/usr/bin/env python3
"""
Comprehensive Remotion Application Testing Script

This script tests the Remotion application running at localhost:3000 by:
1. Taking screenshots of the application
2. Checking for JavaScript console errors
3. Verifying composition sidebar visibility
4. Testing specific compositions
5. Checking network requests
"""

import time
import json
import subprocess
import sys
from selenium import webdriver
from selenium import __version__ as selenium_version
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import chromedriver_autoinstaller


def setup_driver():
    """Setup Chrome WebDriver with appropriate options"""
    try:
        # Auto-install chromedriver if needed
        chromedriver_autoinstaller.install()
    except:
        print("Warning: Could not auto-install chromedriver")

    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    # Enable console logging
    options.add_argument("--enable-logging")
    options.add_argument("--v=1")
    # Enable performance logging for network requests
    options.set_capability("goog:loggingPrefs", {"browser": "ALL", "performance": "ALL"})

    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        print(f"Failed to setup Chrome driver: {e}")
        print("Trying with Safari WebDriver...")
        try:
            driver = webdriver.Safari()
            return driver
        except Exception as e2:
            print(f"Failed to setup Safari driver: {e2}")
            return None


def take_screenshot(driver, filename):
    """Take a screenshot and save it"""
    try:
        screenshot_path = f"/Users/ivan/DEV_/anim/{filename}"
        driver.save_screenshot(screenshot_path)
        print(f"Screenshot saved: {screenshot_path}")
        return screenshot_path
    except Exception as e:
        print(f"Failed to take screenshot: {e}")
        return None


def get_console_logs(driver):
    """Get browser console logs"""
    try:
        logs = driver.get_log("browser")
        return logs
    except Exception as e:
        print(f"Could not retrieve console logs: {e}")
        return []


def get_network_logs(driver):
    """Get network performance logs"""
    try:
        logs = driver.get_log("performance")
        network_logs = []
        for log in logs:
            message = json.loads(log["message"])
            if message["message"]["method"] in [
                "Network.requestWillBeSent",
                "Network.responseReceived",
                "Network.loadingFailed",
            ]:
                network_logs.append(message)
        return network_logs
    except Exception as e:
        print(f"Could not retrieve network logs: {e}")
        return []


def test_remotion_app():
    """Main testing function"""
    print("=== Remotion Application Testing ===")
    print(f"Selenium version: {selenium_version}")

    driver = setup_driver()
    if not driver:
        print("CRITICAL: Could not setup WebDriver")
        return

    try:
        # Navigate to the application
        print("\n1. Navigating to http://localhost:3000...")
        driver.get("http://localhost:3000")
        time.sleep(5)  # Wait for initial load

        # Take initial screenshot
        print("\n2. Taking initial screenshot...")
        take_screenshot(driver, "remotion_initial.png")

        # Check page title
        title = driver.title
        print(f"Page title: {title}")

        # Get console logs
        print("\n3. Checking console logs...")
        console_logs = get_console_logs(driver)
        if console_logs:
            print("Console logs found:")
            for log in console_logs:
                print(f"  {log['level']}: {log['message']}")
        else:
            print("No console logs found")

        # Wait for application to load
        print("\n4. Waiting for application to load...")
        try:
            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            print("Page loaded successfully")
        except TimeoutException:
            print("Warning: Page may not have fully loaded")

        # Take screenshot after load
        take_screenshot(driver, "remotion_loaded.png")

        # Check for Remotion Studio elements
        print("\n5. Checking for Remotion Studio elements...")

        # Look for composition sidebar
        composition_elements = []
        try:
            # Try multiple selectors for compositions
            possible_selectors = [
                '[data-testid="composition-sidebar"]',
                '[class*="composition"]',
                '[class*="sidebar"]',
                'div[role="navigation"]',
                "nav",
                "aside",
            ]

            for selector in possible_selectors:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"Found elements with selector '{selector}': {len(elements)}")
                    composition_elements.extend(elements)
        except Exception as e:
            print(f"Error finding composition elements: {e}")

        # Look for specific compositions by text content
        print("\n6. Looking for specific compositions...")
        target_compositions = [
            "TransitionShowcase",
            "VideoEffects",
            "RhythmVisualization",
            "AudioTriggeredContent",
            "EmojiRhythm",
        ]

        found_compositions = []
        for comp_name in target_compositions:
            try:
                elements = driver.find_elements(By.XPATH, f"//*[contains(text(), '{comp_name}')]")
                if elements:
                    found_compositions.append(comp_name)
                    print(f"  ✓ Found: {comp_name}")
                else:
                    print(f"  ✗ Not found: {comp_name}")
            except Exception as e:
                print(f"  Error searching for {comp_name}: {e}")

        # Take screenshot of compositions area
        take_screenshot(driver, "remotion_compositions.png")

        # Try to click on TransitionShowcase if found
        if "TransitionShowcase" in found_compositions:
            print("\n7. Testing TransitionShowcase composition...")
            try:
                element = driver.find_element(
                    By.XPATH, "//*[contains(text(), 'TransitionShowcase')]"
                )
                element.click()
                time.sleep(3)
                take_screenshot(driver, "remotion_transition_showcase.png")
                print("Successfully clicked TransitionShowcase")
            except Exception as e:
                print(f"Failed to click TransitionShowcase: {e}")

        # Try to click on VideoEffects if found
        if "VideoEffects" in found_compositions:
            print("\n8. Testing VideoEffects composition...")
            try:
                element = driver.find_element(By.XPATH, "//*[contains(text(), 'VideoEffects')]")
                element.click()
                time.sleep(3)
                take_screenshot(driver, "remotion_video_effects.png")
                print("Successfully clicked VideoEffects")
            except Exception as e:
                print(f"Failed to click VideoEffects: {e}")

        # Get final console logs
        print("\n9. Final console log check...")
        final_logs = get_console_logs(driver)

        # Get network logs
        print("\n10. Checking network requests...")
        network_logs = get_network_logs(driver)
        failed_requests = []
        for log in network_logs:
            if log["message"]["method"] == "Network.loadingFailed":
                failed_requests.append(log["message"]["params"]["requestId"])

        if failed_requests:
            print(f"Found {len(failed_requests)} failed network requests")
        else:
            print("No failed network requests found")

        # Final screenshot
        take_screenshot(driver, "remotion_final.png")

        # Summary report
        print("\n=== SUMMARY REPORT ===")
        print(
            f"Application Status: {'WORKING' if title == 'Remotion Studio' else 'ISSUES DETECTED'}"
        )
        print(f"Console Errors: {len([log for log in final_logs if log['level'] == 'SEVERE'])}")
        print(f"Compositions Found: {len(found_compositions)}/{len(target_compositions)}")
        print(
            f"Found Compositions: {', '.join(found_compositions) if found_compositions else 'None'}"
        )
        print(f"Failed Network Requests: {len(failed_requests)}")

        if final_logs:
            print("\nAll Console Messages:")
            for log in final_logs:
                print(f"  [{log['level']}] {log['message']}")

        return {
            "status": "working" if title == "Remotion Studio" else "issues",
            "title": title,
            "console_errors": [log for log in final_logs if log["level"] == "SEVERE"],
            "compositions_found": found_compositions,
            "failed_requests": len(failed_requests),
            "screenshots": [
                "remotion_initial.png",
                "remotion_loaded.png",
                "remotion_compositions.png",
                "remotion_final.png",
            ],
        }

    except Exception as e:
        print(f"CRITICAL ERROR during testing: {e}")
        take_screenshot(driver, "remotion_error.png")
        return {"status": "error", "error": str(e)}

    finally:
        driver.quit()


if __name__ == "__main__":
    # Check if selenium is installed
    try:
        import selenium

        print("Selenium is available")
    except ImportError:
        print("Installing required packages...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "selenium", "chromedriver-autoinstaller"]
        )
        import selenium

    result = test_remotion_app()
    print(f"\nTest completed with result: {result}")
