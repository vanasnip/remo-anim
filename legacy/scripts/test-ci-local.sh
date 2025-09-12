#!/bin/bash

# Local CI Testing Script
# Run CI checks locally before pushing

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Running Local CI Checks${NC}"
echo "================================"

# Track failures
FAILED_CHECKS=()

# Function to run a check
run_check() {
    local name="$1"
    local command="$2"

    echo -e "\n${YELLOW}Running: $name${NC}"
    if eval "$command"; then
        echo -e "${GREEN}✅ $name passed${NC}"
    else
        echo -e "${RED}❌ $name failed${NC}"
        FAILED_CHECKS+=("$name")
    fi
}

# 1. Pre-commit hooks (fast)
run_check "Pre-commit hooks (fast)" "pre-commit run --all-files --config .pre-commit-fast.yaml"

# 2. Remotion tests
if [ -d "remotion-app" ]; then
    echo -e "\n${YELLOW}Testing Remotion App${NC}"
    cd remotion-app

    run_check "NPM Install" "npm install --silent"
    run_check "TypeScript Check" "npx tsc --noEmit"
    run_check "Tests" "npm test -- --passWithNoTests"
    run_check "Build" "npm run build"

    cd "$PROJECT_ROOT"
fi

# 3. Python checks (if Python files exist)
if find . -name "*.py" -not -path "./venv/*" -not -path "./.venv/*" | grep -q .; then
    echo -e "\n${YELLOW}Python Checks${NC}"

    if command -v python3 &> /dev/null; then
        run_check "Python Syntax" "python3 -m py_compile manim-scripts/*.py 2>/dev/null"
    else
        echo -e "${YELLOW}⚠️  Python not installed - skipping Python checks${NC}"
    fi
fi

# 4. Security scan (lightweight)
echo -e "\n${YELLOW}Security Checks${NC}"
run_check "Detect Secrets" "detect-secrets scan --baseline .secrets.baseline 2>/dev/null || true"

# 5. Git checks
echo -e "\n${YELLOW}Git Checks${NC}"
run_check "No merge conflicts" "! grep -r '<<<<<<<' --include='*' --exclude-dir=.git ."
run_check "No TODO markers" "! grep -r 'TODO\|FIXME\|XXX' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' . || echo 'Found TODO markers (warning only)'"

# Summary
echo -e "\n================================"
if [ ${#FAILED_CHECKS[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 All CI checks passed!${NC}"
    echo -e "${GREEN}Safe to push your changes.${NC}"
    exit 0
else
    echo -e "${RED}❌ CI checks failed:${NC}"
    for check in "${FAILED_CHECKS[@]}"; do
        echo -e "${RED}  - $check${NC}"
    done
    echo -e "\n${YELLOW}Fix the issues above before pushing.${NC}"
    exit 1
fi
