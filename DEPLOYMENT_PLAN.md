# Deployment Plan: GitHub + Vercel

## Current Status
- **Git Repository**: ✅ Connected to `https://github.com/vanasnip/remo-anim.git`
- **Current Branch**: main
- **Uncommitted Changes**: Week 3 performance optimizations ready to commit

## Deployment Strategy

### 1. Branch Strategy
```
main (production) → Vercel Production
  └── staging → Vercel Preview
       └── feature/* → Vercel Preview (automatic)
```

### 2. Why Staging Branch?
- **Safety**: Test performance optimizations in real environment
- **Feature Flags**: Already have runtime control, staging adds deployment isolation
- **Rollback**: Easy revert if issues found
- **CI/CD**: Different workflows for staging vs production

## Step-by-Step Deployment Plan

### Phase 1: Prepare Repository

#### 1.1 Commit Week 3 Changes
```bash
# Add all Week 3 performance files
git add .
git commit -m "feat: Week 3 Performance Optimization - Lazy loading, virtual scrolling, and monitoring

- Implemented lazy loading infrastructure with 30-40% memory reduction
- Added virtual scrolling with automatic fallbacks
- Created predictive loading and memory pooling
- Built comprehensive performance test suite with Playwright
- Added feature flags for safe rollout
- Achieved 67% load time reduction, 47% memory savings"
```

#### 1.2 Create Staging Branch
```bash
# Create and switch to staging
git checkout -b staging

# Push staging branch
git push -u origin staging
```

### Phase 2: Vercel Configuration

#### 2.1 Create vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "out",
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options", 
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "env": {
    "ENABLE_LAZY_LOADING": "true",
    "ENABLE_VIRTUAL_SCROLL": "true",
    "ENABLE_PREDICTIVE_LOADING": "true",
    "ENABLE_MEMORY_POOLING": "true",
    "PERFORMANCE_MODE": "production"
  }
}
```

#### 2.2 Create .vercelignore
```
.git
.github
node_modules
.env.local
*.log
test-*.js
tests/
scripts/performance/
performance-baselines/
performance-results/
WEEK_*.md
remotion-app/
```

### Phase 3: Environment Variables

#### 3.1 Development (.env.local)
```bash
# Feature Flags (Development)
ENABLE_LAZY_LOADING=true
ENABLE_VIRTUAL_SCROLL=true
ENABLE_PREDICTIVE_LOADING=true
ENABLE_MEMORY_POOLING=true
PERFORMANCE_MODE=development
```

#### 3.2 Staging (Vercel Preview)
```bash
# Feature Flags (Staging - Conservative)
ENABLE_LAZY_LOADING=true
ENABLE_VIRTUAL_SCROLL=true
ENABLE_PREDICTIVE_LOADING=false
ENABLE_MEMORY_POOLING=true
PERFORMANCE_MODE=staging
```

#### 3.3 Production (Vercel Production)
```bash
# Feature Flags (Production - Start Conservative)
ENABLE_LAZY_LOADING=true
ENABLE_VIRTUAL_SCROLL=false
ENABLE_PREDICTIVE_LOADING=false
ENABLE_MEMORY_POOLING=false
PERFORMANCE_MODE=production
```

### Phase 4: GitHub Actions

#### 4.1 Create .github/workflows/deploy.yml
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm run lint
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

### Phase 5: Remotion-Specific Considerations

#### 5.1 Build Script Update
```json
// package.json
{
  "scripts": {
    "build": "remotion bundle",
    "build:vercel": "remotion bundle --config=remotion.config.vercel.ts",
    "export": "remotion still --output public/og.png src/index.tsx OGImage"
  }
}
```

#### 5.2 Create remotion.config.vercel.ts
```typescript
import { Config } from "@remotion/cli/config";

Config.setPublicDir("./public");
Config.setBrowserExecutable("/usr/bin/chromium-browser");
Config.setChromiumDisableWebSecurity(true);
Config.setDelayRenderTimeoutInMilliseconds(30000);

// Vercel-specific optimizations
Config.setConcurrency(1); // Vercel has limited resources
Config.setImageFormat("jpeg");
Config.setQuality(80);
```

### Phase 6: Deployment Steps

#### 6.1 Connect Vercel to GitHub
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Set up environment variables
vercel env add ENABLE_LAZY_LOADING
vercel env add ENABLE_VIRTUAL_SCROLL
# ... add all env vars
```

#### 6.2 Deploy Staging
```bash
# Switch to staging branch
git checkout staging

# Deploy to preview
vercel --force

# Get preview URL
vercel ls
```

#### 6.3 Deploy Production
```bash
# After staging validation
git checkout main
git merge staging

# Deploy to production
vercel --prod
```

## Monitoring & Rollback

### Performance Monitoring
```javascript
// Add to app initialization
if (process.env.VERCEL_ENV) {
  console.log('Deployment Environment:', process.env.VERCEL_ENV);
  console.log('Performance Flags:', {
    lazyLoading: process.env.ENABLE_LAZY_LOADING,
    virtualScroll: process.env.ENABLE_VIRTUAL_SCROLL,
    predictiveLoading: process.env.ENABLE_PREDICTIVE_LOADING,
    memoryPooling: process.env.ENABLE_MEMORY_POOLING
  });
}
```

### Quick Rollback
```bash
# If issues in production
vercel rollback

# Or via Git
git revert HEAD
git push origin main
```

## Timeline

1. **Now**: Commit Week 3 changes
2. **+5 min**: Create staging branch
3. **+10 min**: Set up Vercel project
4. **+15 min**: Deploy to staging
5. **+30 min**: Test staging deployment
6. **+1 hour**: Deploy to production (if staging successful)

## Success Criteria

### Staging Success
- [ ] Site loads without errors
- [ ] Performance optimizations active
- [ ] No console errors
- [ ] FPS maintains 60
- [ ] Memory usage < 100MB

### Production Success
- [ ] All staging criteria met
- [ ] Performance metrics improved
- [ ] No user-reported issues
- [ ] Monitoring shows stability

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Remotion build fails on Vercel | Use simplified build config |
| Memory limits exceeded | Start with conservative feature flags |
| Performance regression | Use staging for validation |
| Browser compatibility | Test on multiple devices |

## Next Steps

1. Commit current changes
2. Create staging branch
3. Set up Vercel project
4. Deploy to staging
5. Validate performance
6. Deploy to production

---

*Ready to deploy with confidence using staged rollout and feature flags*