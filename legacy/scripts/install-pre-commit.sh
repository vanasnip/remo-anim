#!/usr/bin/env bash

# Pre-commit installation and setup script
set -e

echo "🔧 Setting up pre-commit hooks for CI/CD integration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 is required but not installed.${NC}"
    exit 1
fi

# Install pre-commit
echo "📦 Installing pre-commit..."
pip install --user pre-commit || pip3 install --user pre-commit

# Verify installation
if ! command -v pre-commit &> /dev/null; then
    echo -e "${YELLOW}⚠️  pre-commit not in PATH. Adding to PATH...${NC}"
    export PATH="$HOME/.local/bin:$PATH"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc 2>/dev/null || true
fi

# Install safety for security checks
echo "🔒 Installing safety for security scanning..."
pip install --user safety || pip3 install --user safety

# Create secrets baseline if it doesn't exist
if [ ! -f ".secrets.baseline" ]; then
    echo "🔑 Creating secrets baseline..."
    detect-secrets scan --baseline .secrets.baseline || true
fi

# Install the git hooks
echo "🪝 Installing git hooks..."
pre-commit install --install-hooks
pre-commit install --hook-type commit-msg
pre-commit install --hook-type pre-push

# Update hooks to latest versions
echo "🔄 Updating hooks to latest versions..."
pre-commit autoupdate

# Create hook mode selector script
cat > .git/hooks/select-hook-mode.sh << 'EOF'
#!/usr/bin/env bash

# Hook mode selector
HOOK_MODE_FILE=".git/hooks/hook-mode"

if [ ! -f "$HOOK_MODE_FILE" ]; then
    echo "fast" > "$HOOK_MODE_FILE"
fi

HOOK_MODE=$(cat "$HOOK_MODE_FILE")

case "$HOOK_MODE" in
    fast)
        CONFIG=".pre-commit-fast.yaml"
        ;;
    full)
        CONFIG=".pre-commit-config.yaml"
        ;;
    skip)
        exit 0
        ;;
    *)
        CONFIG=".pre-commit-config.yaml"
        ;;
esac

pre-commit run --config "$CONFIG" "$@"
EOF

chmod +x .git/hooks/select-hook-mode.sh

# Create mode switching helper
cat > hooks-mode << 'EOF'
#!/usr/bin/env bash

# Pre-commit hooks mode switcher
HOOK_MODE_FILE=".git/hooks/hook-mode"

case "$1" in
    fast)
        echo "fast" > "$HOOK_MODE_FILE"
        echo "✅ Switched to FAST mode (basic checks only)"
        ;;
    full)
        echo "full" > "$HOOK_MODE_FILE"
        echo "✅ Switched to FULL mode (comprehensive CI/CD checks)"
        ;;
    skip)
        echo "skip" > "$HOOK_MODE_FILE"
        echo "⏭️  Switched to SKIP mode (no pre-commit checks)"
        ;;
    status)
        if [ -f "$HOOK_MODE_FILE" ]; then
            MODE=$(cat "$HOOK_MODE_FILE")
            echo "Current mode: $MODE"
        else
            echo "Current mode: fast (default)"
        fi
        ;;
    *)
        echo "Usage: ./hooks-mode [fast|full|skip|status]"
        echo ""
        echo "Modes:"
        echo "  fast   - Quick formatting and syntax checks (default)"
        echo "  full   - Complete CI/CD pipeline checks"
        echo "  skip   - Disable all pre-commit checks"
        echo "  status - Show current mode"
        exit 1
        ;;
esac
EOF

chmod +x hooks-mode

# Set default mode to fast
echo "fast" > .git/hooks/hook-mode

# Run initial checks
echo ""
echo "🧪 Running initial validation..."
pre-commit run --config .pre-commit-fast.yaml --all-files || true

echo ""
echo -e "${GREEN}✅ Pre-commit hooks installed successfully!${NC}"
echo ""
echo "📚 Usage:"
echo "  ./hooks-mode fast   - Use fast checks (default)"
echo "  ./hooks-mode full   - Use comprehensive CI/CD checks"
echo "  ./hooks-mode skip   - Temporarily disable hooks"
echo "  ./hooks-mode status - Show current mode"
echo ""
echo "🚀 Quick commands:"
echo "  pre-commit run --all-files              - Run on all files"
echo "  pre-commit run --config .pre-commit-fast.yaml  - Run fast checks"
echo "  git commit --no-verify                  - Skip hooks for one commit"
echo ""
echo "Current mode: $(cat .git/hooks/hook-mode 2>/dev/null || echo 'fast')"
