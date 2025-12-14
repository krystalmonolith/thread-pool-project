# Quick Integration Guide

## 🚀 Adding Recursive Stress Tests to Your Project

Follow these simple steps to integrate the comprehensive stress tests into your rx-thread-pool package.

---

## Step 1: Copy Test Files

Copy these 4 files to `rx-thread-pool/src/`:

```bash
cd thread-pool-project/rx-thread-pool/src/

# Copy the test files
cp /path/to/outputs/recursive-merge-sort.test.ts .
cp /path/to/outputs/recursive-tree-traversal.test.ts .
cp /path/to/outputs/recursive-matrix-multiply.test.ts .
cp /path/to/outputs/run-all-recursive-tests.ts .
```

---

## Step 2: Update package.json

Add these lines to `rx-thread-pool/package.json` in the `"scripts"` section:

```json
{
  "scripts": {
    "build": "tsc && shx cp src/worker.js dist/worker.js",
    "pretest": "npm run build",
    "test": "node dist/example.js",
    "pretest-advanced": "npm run build",
    "test-advanced": "node dist/advanced-example.js",
    "clean": "rimraf dist",
    
    "pretest-recursive-merge": "npm run build",
    "test-recursive-merge": "node dist/recursive-merge-sort.test.js",
    
    "pretest-recursive-tree": "npm run build",
    "test-recursive-tree": "node dist/recursive-tree-traversal.test.js",
    
    "pretest-recursive-matrix": "npm run build",
    "test-recursive-matrix": "node dist/recursive-matrix-multiply.test.js",
    
    "pretest-recursive-all": "npm run build",
    "test-recursive-all": "node dist/run-all-recursive-tests.js"
  }
}
```

**Explanation:**
- `pretest-*` scripts automatically run `npm run build` before each test
- This ensures tests always run with the latest compiled code

---

## Step 3: Build the Project

```bash
cd rx-thread-pool
npm run build
```

This compiles the TypeScript files including the new tests.

---

## Step 4: Run Tests

### Individual Tests

**Merge Sort Test** (~2-3 minutes):
```bash
npm run test-recursive-merge
```

**Tree Traversal Test** (~3-4 minutes):
```bash
npm run test-recursive-tree
```

**Matrix Multiplication Test** (~5-10 minutes):
```bash
npm run test-recursive-matrix
```

### Full Test Suite

**All Recursive Tests** (~10-20 minutes):
```bash
npm run test-recursive-all
```

This runs all three tests sequentially with a master test runner.

---

## Step 5: Verify Success

All tests should:
- ✅ Complete without errors
- ✅ Show "✅ PASS" for result verification
- ✅ Display performance metrics
- ✅ Properly cleanup threads

Example successful output:
```
╔═══════════════════════════════════════════════════════════════╗
║                      TEST SUITE SUMMARY                       ║
╚═══════════════════════════════════════════════════════════════╝

  ✅ PASS  Recursive Merge Sort        2.34m
  ✅ PASS  Binary Tree Traversal       3.12m
  ✅ PASS  Matrix Multiplication       8.45m

  Total Duration: 13.91 minutes
  Tests Passed: 3 / 3

  🎉 ALL TESTS PASSED! 🎉
```

---

## Alternative: Quick Test (Faster Execution)

If you want faster tests for quick validation, create a `test-quick.ts` with reduced parameters:

```typescript
// Quick versions - edit the test files to use smaller sizes:
const TEST_CASES = [
  { name: 'Quick Test', size: 1000, maxDepth: 2 }
];
```

---

## Troubleshooting

### Test Takes Too Long
- Reduce array/matrix sizes in test files
- Lower max recursion depth
- Run tests individually instead of all at once

### Out of Memory
- Close other applications
- Reduce test data sizes
- Run tests individually with delays between

### Build Errors
```bash
npm run clean
npm install
npm run build
```

### Tests Don't Run
- Check Node.js version: `node --version` (should be >= 16.0.0)
- Verify RxJS installed: `npm ls rxjs`
- Check dist folder exists: `ls dist/`

---

## File Structure After Integration

```
rx-thread-pool/
├── src/
│   ├── AbstractThreadTask.ts
│   ├── ThreadPool.ts
│   ├── ThreadQueue.ts
│   ├── worker.js
│   ├── index.ts
│   ├── example.ts
│   ├── advanced-example.ts
│   ├── recursive-merge-sort.test.ts        ← NEW
│   ├── recursive-tree-traversal.test.ts    ← NEW
│   ├── recursive-matrix-multiply.test.ts   ← NEW
│   └── run-all-recursive-tests.ts          ← NEW
├── dist/                                    (generated)
├── package.json                             (updated)
└── README.md
```

---

## What Gets Published to npm?

Don't worry! The `.npmignore` file ensures test files are excluded:

```
# .npmignore already has:
src/
*.test.ts
*.spec.ts
```

Only the `dist/` folder and essential files are published.

---

## CI/CD Integration (Optional)

Add to `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd rx-thread-pool && npm install
      - run: cd rx-thread-pool && npm test
      - run: cd rx-thread-pool && npm run test-advanced
      - run: cd rx-thread-pool && npm run test-recursive-all
```

---

## Pre-Deployment Checklist

Before publishing to npm:

- [ ] All basic tests pass: `npm test`
- [ ] Advanced tests pass: `npm run test-advanced`
- [ ] Recursive tests pass: `npm run test-recursive-all`
- [ ] No memory leaks observed
- [ ] Build succeeds: `npm run build`
- [ ] Clean install works: `npm ci`
- [ ] Package contents correct: `npm pack --dry-run`

---

## Quick Commands Reference

```bash
# Build
npm run build

# Clean build
npm run clean && npm run build

# Basic tests
npm test
npm run test-advanced

# Recursive stress tests
npm run test-recursive-merge    # ~2-3 min
npm run test-recursive-tree     # ~3-4 min
npm run test-recursive-matrix   # ~5-10 min
npm run test-recursive-all      # ~10-20 min (all three)

# Full validation
npm run clean && npm run build && npm test && npm run test-recursive-all
```

---

## Next Steps

After successful testing:
1. Update version: `npm version patch`
2. Commit changes: `git commit -am "Add recursive stress tests"`
3. Push to GitHub: `git push origin master`
4. Publish to npm: `npm publish --access public`

🎉 **You're ready for production deployment!**
