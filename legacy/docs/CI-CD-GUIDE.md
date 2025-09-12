# CI/CD Guide

## Overview

This project uses a comprehensive CI/CD pipeline with GitHub Actions and pre-commit hooks for quality assurance.

## 🚀 Quick Start

### Local Development

1. **Install pre-commit hooks:**

   ```bash
   pre-commit install
   pre-commit install --config .pre-commit-full.yaml --hook-type pre-push
   ```

2. **Run local CI checks:**

   ```bash
   ./scripts/test-ci-local.sh
   ```

3. **Manual pre-commit run:**

   ```bash
   # Fast checks (for commits)
   pre-commit run --all-files --config .pre-commit-fast.yaml

   # Full checks (for pushes)
   pre-commit run --all-files --config .pre-commit-full.yaml
   ```

## 🔧 Configuration Files

### Pre-commit Hooks

- `.pre-commit-fast.yaml` - Quick checks for every commit (~5 seconds)
- `.pre-commit-full.yaml` - Comprehensive checks for push operations (~30 seconds)
- `.pre-commit-config.yaml` - Default configuration (symlink to fast)

### GitHub Actions Workflows

- `.github/workflows/ci.yml` - Main CI pipeline
- `.github/workflows/release.yml` - Release automation

### Security

- `.gitleaks.toml` - Secret scanning configuration
- `.secrets.baseline` - Detected secrets baseline (false positives)

## 📋 CI Pipeline Stages

### 1. Pre-commit Stage

- Trailing whitespace removal
- File ending fixes
- YAML/JSON validation
- Merge conflict detection
- Secret detection
- Code formatting (Black, Prettier)

### 2. Test Stage (Remotion)

- Dependency installation
- Unit tests
- TypeScript compilation
- Build verification

### 3. Security Stage

- Trivy vulnerability scanning
- Secret detection
- Dependency auditing

### 4. Python Stage (Conditional)

- Black formatting check
- Flake8 linting
- MyPy type checking

## 🔒 Branch Protection

Configure branch protection using:

```bash
export GITHUB_TOKEN=your_token_here
./scripts/setup-branch-protection.sh
```

Protected branches require:

- All CI checks passing
- PR reviews (1 approval minimum)
- Up-to-date branches
- Conversation resolution

## 🏷️ Release Process

1. **Create a version tag:**

   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. **Automatic release:**
   - GitHub Actions builds the application
   - Creates release with changelog
   - Uploads build artifacts

## 🛠️ Troubleshooting

### Pre-commit Hook Failures

**Issue:** Hooks fail on commit

```bash
# Skip hooks temporarily (use sparingly!)
git commit --no-verify -m "Emergency fix"

# Fix and re-run
pre-commit run --all-files
```

**Issue:** Python not found

```bash
# Install Python 3.11+
brew install python@3.11  # macOS
# or
sudo apt install python3.11  # Ubuntu
```

### Secret Detection False Positives

**Issue:** Legitimate IDs flagged as secrets

```bash
# Update baseline
detect-secrets scan --baseline .secrets.baseline

# Or add inline comment
some_id = "abc123"  # pragma: allowlist secret
```

### CI Pipeline Failures

**Issue:** Tests pass locally but fail in CI

```bash
# Run exact CI environment
docker run -it node:20 bash
# Clone repo and run tests
```

## 📊 Performance Optimization

### Hook Performance

| Hook Type     | Target Time | Actual Time |
| ------------- | ----------- | ----------- |
| Fast (commit) | <5s         | ~3-5s       |
| Full (push)   | <30s        | ~20-30s     |
| CI Pipeline   | <5min       | ~3-4min     |

### Optimization Tips

1. **Use fast hooks for commits:**
   - Only essential checks
   - Defer heavy operations to push

2. **Parallel execution:**
   - GitHub Actions runs jobs in parallel
   - Local scripts use background processes

3. **Caching:**
   - npm dependencies cached
   - Docker layers cached
   - Pre-commit environments cached

## 🔄 Maintenance

### Weekly Tasks

- Review and update dependencies
- Check for new security advisories
- Update pre-commit hooks: `pre-commit autoupdate`

### Monthly Tasks

- Review CI pipeline performance
- Update branch protection rules
- Audit secret detection baseline

### Quarterly Tasks

- Major dependency updates
- CI/CD pipeline optimization
- Security audit

## 📚 Additional Resources

- [Pre-commit Documentation](https://pre-commit.com/)
- [GitHub Actions Guide](https://docs.github.com/en/actions)
- [Gitleaks Documentation](https://github.com/zricethezav/gitleaks)
- [Trivy Security Scanner](https://aquasecurity.github.io/trivy/)
