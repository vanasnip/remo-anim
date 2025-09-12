# Pre-commit Hooks Guide

## Overview

This project uses a **simplified pre-commit framework** focused on essential checks that help development without blocking productivity.

## Current Configuration

### Active Hooks (Fast & Essential)

1. **Prettier** - Code formatting
   - JavaScript/TypeScript files
   - JSON, YAML, Markdown
   - CSS and other web assets
   - Runs automatically, fixes issues

2. **Basic File Checks**
   - `trailing-whitespace` - Removes trailing spaces
   - `end-of-file-fixer` - Ensures files end with newline
   - `mixed-line-ending` - Standardizes to LF line endings

3. **Conflict Prevention**
   - `check-merge-conflict` - Prevents committing merge markers
   - `check-case-conflict` - Detects case conflicts

4. **Validation**
   - `check-json` - Validates JSON syntax
   - `check-yaml` - Validates YAML syntax
   - `check-toml` - Validates TOML syntax

5. **Security**
   - `check-added-large-files` - Blocks files >1MB
   - `detect-private-key` - Prevents committing private keys

## Disabled Hooks (Run Manually)

Complex checks have been moved to manual/CI workflows:

### Python Quality Checks

```bash
# Format Python code
black manim-scripts/

# Lint Python code
ruff check manim-scripts/ --fix

# Type checking
mypy manim-scripts/
```

### JavaScript/TypeScript Quality

```bash
# Navigate to Remotion app
cd remotion-app

# Run ESLint
npm run lint

# Type checking
npx tsc --noEmit

# Run tests
npm test
```

### Security Scanning

```bash
# Python security
bandit -r manim-scripts/ -ll
safety check

# JavaScript security
cd remotion-app && npm audit
```

## Usage

### Normal Commits

Pre-commit hooks run automatically:

```bash
git add .
git commit -m "Your message"
```

### Skipping Hooks (When Needed)

Skip all hooks:

```bash
git commit --no-verify -m "Emergency fix"
```

Skip specific hooks:

```bash
SKIP=prettier git commit -m "Keep current formatting"
SKIP=check-json,check-yaml git commit -m "WIP config files"
```

### Manual Hook Execution

Run hooks without committing:

```bash
# Run all hooks
pre-commit run --all-files

# Run specific hook
pre-commit run prettier --all-files
pre-commit run trailing-whitespace --all-files
```

## Troubleshooting

### Hook Failures

If hooks fail, they often auto-fix issues:

1. Review the changes: `git diff`
2. Add the fixes: `git add .`
3. Retry commit: `git commit -m "Your message"`

### Common Issues

| Issue                  | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Prettier changes files | Files were auto-formatted, add changes and retry |
| Large file detected    | Use Git LFS or reduce file size                  |
| Merge conflict markers | Resolve conflicts before committing              |
| JSON/YAML syntax error | Fix syntax errors in the file                    |

### Installation Issues

If pre-commit isn't installed:

```bash
# Install pre-commit
pip install pre-commit

# Install the git hooks
pre-commit install
```

## Configuration File

Location: `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        files: \.(js|jsx|ts|tsx|json|css|scss|md|yml|yaml)$

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      # ... other hooks
```

## Philosophy

Our pre-commit setup follows these principles:

1. **Fast Execution** - Hooks should complete in seconds
2. **Auto-fixable** - Prefer hooks that fix issues automatically
3. **Essential Only** - Focus on formatting and basic validation
4. **Non-blocking** - Complex checks belong in CI/CD
5. **Developer-friendly** - Easy to understand and skip when needed

## Best Practices

1. **Let hooks run** - They maintain consistency
2. **Review auto-fixes** - Check what was changed with `git diff`
3. **Fix root causes** - Don't repeatedly skip the same hook
4. **Update IDE** - Configure your IDE to match Prettier settings
5. **Run manual checks** - Periodically run linting and tests

## CI/CD Integration

While pre-commit handles basics, CI/CD should run:

- Full test suites
- Complete linting (ESLint, ruff)
- Type checking (TypeScript, mypy)
- Security scanning
- Build validation
- Deploy checks

This separation keeps development fast while maintaining quality.
