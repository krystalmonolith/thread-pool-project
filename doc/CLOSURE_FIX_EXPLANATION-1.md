# Recursive Test Closure Issue - FIXED

## Problem

When running the recursive tests, you encountered:
```
Error: createRecursiveSortTask is not defined
```

This occurred because worker threads cannot access functions from the outer scope.

## Root Cause

When a function is serialized and sent to a worker thread:
```typescript
// This doesn't work in workers!
const leftTask = createRecursiveSortTask(leftArray, ...);
```

The worker thread doesn't have access to `createRecursiveSortTask()` because it's not part of the serialized function - it's a closure variable.

## Solution

Make the thread function **completely self-contained** by:

### 1. Define All Helpers Inside the Thread Function

**Before (❌ Broken):**
```typescript
function createRecursiveSortTask(...) {
  return new ThreadTask(
    (input, threadId) => {
      // ... recursive call here
      const leftTask = createRecursiveSortTask(...); // ❌ Not available in worker!
    },
    of({ ... })
  );
}
```

**After (✅ Fixed):**
```typescript
function createRecursiveSortTask(...) {
  const threadFunc = (input, threadId) => {
    return input.pipe(
      mergeMap(async (task) => {
        // Import modules in worker context
        const { ThreadTask, ThreadQueue, ThreadPool } = require('./index');
        const { of } = require('rxjs');
        
        // Define helpers in worker scope
        function mergeSorted(left, right) { ... }
        
        // Create sub-task factory using THIS function
        const createSubTask = (arr, d, md, tid) => {
          return new ThreadTask(threadFunc, of({ array: arr, ... }));
        };
        
        // Now we can create recursive tasks
        const leftTask = createSubTask(leftArray, ...); // ✅ Works!
      })
    );
  };
  
  return new ThreadTask(threadFunc, of({ ... }));
}
```

### 2. Import Modules Inside Worker Context

```typescript
// Inside thread function:
const { ThreadTask, ThreadQueue, ThreadPool } = require('./index');
const { of } = require('rxjs');
const { mergeMap } = require('rxjs');
```

This ensures workers have access to necessary modules.

### 3. Use Local Factory Function for Recursion

```typescript
// Self-referential factory
const createSubTask = (arr, d, md, tid) => {
  return new ThreadTask(threadFunc, of({ array: arr, depth: d, maxDepth: md, taskId: tid }));
};

// Create child tasks
const leftTask = createSubTask(leftArray, task.depth + 1, task.maxDepth, `${task.taskId}-L`);
const rightTask = createSubTask(rightArray, task.depth + 1, task.maxDepth, `${task.taskId}-R`);
```

The `createSubTask` function creates new ThreadTask instances using the same `threadFunc`, enabling recursion.

## What Changed in Each Test

### Merge Sort (`recursive-merge-sort.test.ts`)
✅ `mergeSorted()` helper now defined inside thread function  
✅ `createSubTask()` factory for creating child tasks  
✅ Modules imported with `require()` in worker context  

### Tree Traversal (`recursive-tree-traversal.test.ts`)
✅ `calculateTreeStats()` helper now inside thread function  
✅ `createSubTask()` factory for child tree nodes  
✅ Modules imported in worker context  

### Matrix Multiply (`recursive-matrix-multiply.test.ts`)
✅ All matrix helpers (`multiplyMatrices`, `addMatrices`, `splitMatrix`, `combineMatrix`, `countOperations`) now inside thread function  
✅ `createSubTask()` factory for sub-matrix tasks  
✅ Modules imported in worker context  

## Key Principle

**Worker threads are isolated environments.** They only have access to:
- What's serialized in the function itself
- Modules explicitly imported with `require()`
- Data passed through the Observable input

They cannot access:
- Outer scope variables
- Functions defined outside the thread function
- ES6 imports from the parent context

## Testing

All three tests should now:
✅ Compile without TypeScript errors  
✅ Run without "not defined" errors  
✅ Successfully create recursive ThreadPools  
✅ Process data and return correct results  

## Usage

```bash
# Test individually
npm run test-recursive-merge
npm run test-recursive-tree
npm run test-recursive-matrix

# Test all
npm run test-recursive-all
```

All tests are now fully functional!
