#!/bin/bash
# Developer Environment Setup Script
# Sets up formatting, linting, and validation for the Manim-Remotion Bridge

set -e  # Exit on error

echo "🚀 Setting up Manim-Remotion Bridge Development Environment"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python version
echo -e "${YELLOW}Checking Python version...${NC}"
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    echo -e "${GREEN}✓ Python ${PYTHON_VERSION} found${NC}"
else
    echo -e "${RED}✗ Python 3 not found. Please install Python 3.8+${NC}"
    exit 1
fi

# Check Node.js
echo -e "${YELLOW}Checking Node.js...${NC}"
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION} found${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 16+${NC}"
    exit 1
fi

# Install Python formatting and linting tools
echo -e "${YELLOW}Installing Python tools...${NC}"
pip3 install --upgrade pip
pip3 install black==23.* ruff mypy pre-commit

# Install Node.js tools
echo -e "${YELLOW}Installing Node.js tools...${NC}"
cd remotion-app
npm install --save-dev prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
cd ..

# Create format-all script
echo -e "${YELLOW}Creating format-all script...${NC}"
cat > format-all.sh << 'EOF'
#!/bin/bash
# Format all code in the project

echo "🎨 Formatting Python code..."
black --line-length=100 manim-scripts/ bridge/ tests/
ruff check --fix manim-scripts/ bridge/ tests/

echo "🎨 Formatting TypeScript/React code..."
cd remotion-app
npx prettier --write "src/**/*.{ts,tsx,js,jsx,json}"
npx eslint --fix "src/**/*.{ts,tsx}"
cd ..

echo "✅ All code formatted!"
EOF
chmod +x format-all.sh

# Create check-all script
echo -e "${YELLOW}Creating check-all script...${NC}"
cat > check-all.sh << 'EOF'
#!/bin/bash
# Check all code without modifying

echo "🔍 Checking Python code..."
black --check --line-length=100 manim-scripts/ bridge/ tests/
ruff check manim-scripts/ bridge/ tests/
mypy bridge/ --ignore-missing-imports

echo "🔍 Checking TypeScript/React code..."
cd remotion-app
npx prettier --check "src/**/*.{ts,tsx,js,jsx,json}"
npx eslint "src/**/*.{ts,tsx}"
npm run type-check
cd ..

echo "✅ All checks complete!"
EOF
chmod +x check-all.sh

# Set up git aliases
echo -e "${YELLOW}Setting up git aliases...${NC}"
git config --local alias.format '!./format-all.sh'
git config --local alias.check '!./check-all.sh'
git config --local alias.quick 'commit --no-verify'

# Create .prettierrc if it doesn't exist
if [ ! -f "remotion-app/.prettierrc" ]; then
    echo -e "${YELLOW}Creating Prettier config...${NC}"
    cat > remotion-app/.prettierrc << 'EOF'
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "es5",
  "arrowParens": "avoid",
  "semi": true,
  "tabWidth": 2
}
EOF
fi

# Create .eslintrc.js if it doesn't exist
if [ ! -f "remotion-app/.eslintrc.js" ]; then
    echo -e "${YELLOW}Creating ESLint config...${NC}"
    cat > remotion-app/.eslintrc.js << 'EOF'
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
EOF
fi

# Install pre-commit hooks (optional)
echo -e "${YELLOW}Setting up pre-commit hooks...${NC}"
if [ -f ".pre-commit-config.yaml" ]; then
    pre-commit install --allow-missing-config
    echo -e "${GREEN}✓ Pre-commit hooks installed${NC}"
else
    echo -e "${YELLOW}⚠ No .pre-commit-config.yaml found, skipping hook installation${NC}"
fi

# Create VS Code workspace recommendations
echo -e "${YELLOW}Creating VS Code recommendations...${NC}"
mkdir -p .vscode
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.black-formatter",
    "charliermarsh.ruff",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag"
  ]
}
EOF

# Summary
echo ""
echo -e "${GREEN}✅ Development environment setup complete!${NC}"
echo ""
echo "Available commands:"
echo "  ./format-all.sh    - Format all code"
echo "  ./check-all.sh     - Check code without modifying"
echo "  git format         - Format all code (git alias)"
echo "  git check          - Check all code (git alias)"
echo "  git quick          - Commit without pre-commit hooks"
echo ""
echo "VS Code will automatically:"
echo "  - Format on save"
echo "  - Show linting errors"
echo "  - Organize imports"
echo ""
echo "To bypass pre-commit hooks when needed:"
echo "  git commit --no-verify -m 'WIP: description'"
echo ""
echo -e "${YELLOW}Happy coding! 🚀${NC}"
EOF
