# Phase 2: Component Migration Plan

## Audit Results

### ✅ Safe to Migrate (High Priority)

#### 1. **ProductPromo Component** (READY)
- **Location**: `legacy/remotion-app/src/compositions/ProductPromo.tsx`
- **Dependencies**: Material-UI, Remotion hooks
- **Features**: Animated product showcase with gradient background
- **Test**: Has unit tests that can be adapted
- **Priority**: HIGH - Clean, tested, immediately useful

#### 2. **ManimBridge Components** (READY)
- **Location**: `legacy/remotion-app/src/ManimBridge.tsx`
- **Components**: 
  - `ManimVideo` - Wrapper for Manim video playback
  - `ManimComposition` - Container for Manim videos
- **Priority**: HIGH - Complements our ManimShowcase

#### 3. **HelloWorld Logo Components** (READY)
- **Location**: `legacy/remotion-app/src/HelloWorld/`
- **Components**:
  - `Logo.tsx` - Animated logo with Arc and Atom
  - `Arc.tsx` - Arc animation component
  - `Atom.tsx` - Atom animation component
  - `Title.tsx` - Animated title component
  - `Subtitle.tsx` - Animated subtitle component
- **Priority**: MEDIUM - Useful animation components

### 📋 Test Suites to Migrate

1. **ProductPromo.test.tsx** - Unit tests for ProductPromo
2. **setupTests.ts** - Test configuration

### 🐍 Python/Manim Assets (Already Migrated)

- ✅ CircleAreaDemo
- ✅ SineWaveAnimation  
- ✅ TestAnimation

### Additional Manim Scripts Available:
- `legacy/manim-scripts/simple_example.py`
- `legacy/manim-scripts/test_animation.py`

## Migration Priority Order

### Phase 2.1: Immediate Migration (Today)
1. **ProductPromo** component with Material-UI
2. **ProductPromo tests** 
3. **ManimBridge** components

### Phase 2.2: Secondary Migration
1. **HelloWorld Logo** components (Arc, Atom, etc.)
2. **Title & Subtitle** animation components
3. Test setup configuration

### Phase 2.3: Asset Consolidation
1. Review remaining Manim scripts
2. Port any missing documentation
3. Archive what's not needed

## Migration Checklist

### For Each Component:
- [ ] Copy component file to new location
- [ ] Update imports for new structure
- [ ] Remove any webpack.override dependencies
- [ ] Verify no Node.js module usage
- [ ] Update TypeScript types if needed
- [ ] Test in isolation
- [ ] Adapt existing tests
- [ ] Document in CLAUDE.md

## Components to AVOID

❌ **DO NOT MIGRATE**:
- Anything requiring webpack.override.js
- Audio analysis with WebAssembly
- Components with Node.js polyfills
- Broken build configurations

## Success Criteria

- All migrated components work without errors
- Tests pass for migrated components
- No Node.js/browser boundary violations
- Performance remains optimal
- Documentation updated

## Next Steps

1. Start with ProductPromo migration
2. Set up Material-UI if not present
3. Migrate and adapt tests
4. Continue with ManimBridge components