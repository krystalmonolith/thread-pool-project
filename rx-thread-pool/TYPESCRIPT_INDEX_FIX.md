# TypeScript Compilation Issue: index_1 Not Defined

## Problem

When running the recursive tests, you encountered:
```
Error: index_1 is not defined
```

## Root Cause

When TypeScript compiles ES6 imports, it creates namespace references:

**Your TypeScript code:**
```typescript
import { ThreadTask, ThreadQueue, ThreadPool } from './index';

// Later in code:
new ThreadTask(...)
new ThreadQueue(...)
```

**TypeScript compiles to:**
```javascript
const index_1 = require("./index");

// Later in code:
new index_1.ThreadTask(...)
new index_1.ThreadQueue(...)
```

When the thread function is serialized and sent to the worker, it contains references to `index_1`, but that variable doesn't exist in the worker context!

## Solution

The `worker.js` file now handles these TypeScript compilation patterns by:

### 1. Detecting and Replacing index_N Patterns

```javascript
// Replace index_1, index_2, etc. with 'framework.'
processedFunctionString = processedFunctionString.replace(/index_\d+\./g, 'framework.');
```

This transforms:
```javascript
new index_1.ThreadTask(...)  →  new framework.ThreadTask(...)
```

### 2. Providing Framework in Context

```javascript
const context = {
  // ... rxjs operators ...
  framework: framework,           // ← Provides framework namespace
  ThreadTask: framework.ThreadTask,
  ThreadQueue: framework.ThreadQueue,
  ThreadPool: framework.ThreadPool
};
```

Now `framework.ThreadTask`, `framework.ThreadQueue`, and `framework.ThreadPool` are all available in the worker execution context!

## TypeScript Compilation Patterns Handled

The updated worker.js now handles ALL these TypeScript compilation patterns:

| TypeScript Import | Compiled Pattern | Replacement |
|-------------------|------------------|-------------|
| `import * as rxjs from 'rxjs'` | `rxjs_1.` | `rxjs.` |
| `import { of } from 'rxjs'` | `import_rxjs2.` | `rxjs.` |
| `import { ThreadTask } from './index'` | `index_1.` | `framework.` |
| `import * as operators from 'rxjs/operators'` | `operators_1.` | `operators.` |

## How It Works

```
TypeScript Source          Compiled JavaScript         Worker Context
────────────────          ───────────────────         ──────────────
import { ThreadTask }  →  const index_1 = require() → framework = require()
from './index';                                       
                                                      
new ThreadTask(...)    →  new index_1.ThreadTask()  → new framework.ThreadTask()
                              ↑                           ↑
                          Referenced in                Available in
                          serialized code              worker context!
```

## Testing

After updating `worker.js`, rebuild and test:

```bash
npm run build
npm run test-recursive-merge
```

You should now see:
```
[Depth 0] Thread 0 sorting 5000 elements (task: ROOT)
[Depth 0] Thread 0 splitting: left=2500, right=2500
[Depth 1] Thread 1 sorting 2500 elements (task: ROOT-L)
...
✅ Test Results: Small Array, Shallow
```

## Key Takeaway

Worker threads require **explicit handling** of TypeScript's compilation artifacts. The serialized function string contains references like `index_1` that must be mapped to actual objects in the worker's execution context.

The updated `worker.js` acts as a **translation layer** between TypeScript's compiled output and the worker thread's runtime environment.
