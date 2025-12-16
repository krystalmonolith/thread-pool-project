import { Observable, of, firstValueFrom } from 'rxjs';
import { map, filter, toArray, mergeMap } from 'rxjs';
import { ThreadTask, ThreadQueue, ThreadPool } from './index';

console.log('=== Recursive Parallel Merge Sort Test ===\n');

interface SortTask {
  array: number[];
  depth: number;
  maxDepth: number;
  taskId: string;
  threadFuncString?: string;  // ⭐ Pass function as string for recursion
}

interface SortResult {
  threadId: number;
  sorted: number[];
  depth: number;
  taskId: string;
  threadsCreated: number;
}

/**
 * Merge two sorted arrays
 */
function mergeSorted(left: number[], right: number[]): number[] {
  const result: number[] = [];
  let i = 0, j = 0;
  
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }
  
  return result.concat(left.slice(i)).concat(right.slice(j));
}

/**
 * Create a recursive parallel sort task
 * Note: The thread function must be self-contained (no external closures)
 */
function createRecursiveSortTask(
  array: number[], 
  depth: number, 
  maxDepth: number,
  taskId: string
): ThreadTask {
  // Thread function that will be serialized - must be completely self-contained
  const threadFunc = (input: Observable<SortTask>, threadId: number) => {
    return input.pipe(
      mergeMap(async (task) => {
        // ThreadTask, ThreadQueue, ThreadPool, of, mergeMap are available in worker context
        
        console.log(`[Depth ${task.depth}] Thread ${threadId} sorting ${task.array.length} elements (task: ${task.taskId})`);
        
        // Merge sorted arrays helper (defined in worker scope)
        function mergeSorted(left: number[], right: number[]): number[] {
          const result: number[] = [];
          let i = 0, j = 0;
          while (i < left.length && j < right.length) {
            if (left[i] <= right[j]) {
              result.push(left[i++]);
            } else {
              result.push(right[j++]);
            }
          }
          return result.concat(left.slice(i)).concat(right.slice(j));
        }
        
        // Base case: sort directly when at max depth or array is small
        if (task.depth >= task.maxDepth || task.array.length <= 1000) {
          const sorted = [...task.array].sort((a, b) => a - b);
          console.log(`[Depth ${task.depth}] Thread ${threadId} completed base sort of ${sorted.length} elements`);
          return { 
            threadId, 
            sorted,
            depth: task.depth,
            taskId: task.taskId,
            threadsCreated: 1
          };
        }
        
        // Recursive case: split and create new ThreadPool
        const mid = Math.floor(task.array.length / 2);
        const leftArray = task.array.slice(0, mid);
        const rightArray = task.array.slice(mid);
        
        console.log(`[Depth ${task.depth}] Thread ${threadId} splitting: left=${leftArray.length}, right=${rightArray.length}`);
        
        // Reconstruct the function from the passed string for recursion
        // This is the key to making recursion work without closure variables
        const funcString = task.threadFuncString || '';
        const recreatedFunc = new Function('input', 'threadId', 
          'return (' + funcString + ')(input, threadId)'
        );
        
        // Create sub-tasks with the function string passed along
        const leftTask = new ThreadTask(
          recreatedFunc as any,
          of({ 
            array: leftArray, 
            depth: task.depth + 1, 
            maxDepth: task.maxDepth, 
            taskId: `${task.taskId}-L`,
            threadFuncString: funcString
          })
        );
        
        const rightTask = new ThreadTask(
          recreatedFunc as any,
          of({ 
            array: rightArray, 
            depth: task.depth + 1, 
            maxDepth: task.maxDepth, 
            taskId: `${task.taskId}-R`,
            threadFuncString: funcString
          })
        );
        
        // Create new ThreadPool for this level
        const queue = new ThreadQueue(`sort-depth-${task.depth}`);
        queue.enqueue(leftTask);
        queue.enqueue(rightTask);
        
        const pool = new ThreadPool([queue]);
        const results$ = pool.start();
        
        if (!results$) {
          throw new Error('Failed to start thread pool');
        }
        
        // Collect all results
        const allResults: any[] = [];
        
        await new Promise<void>((resolve, reject) => {
          results$.subscribe({
            next: (result: any) => {
              if (result.error) {
                console.error(`[Depth ${task.depth}] Error in sub-task:`, result.error);
                reject(new Error(result.error));
              } else if (!result.completed && result.value) {
                allResults.push(result.value);
              }
            },
            error: reject,
            complete: resolve
          });
        });
        
        // Extract sorted arrays
        const sortedResults = allResults
          .sort((a, b) => a.taskId.localeCompare(b.taskId))
          .map(r => r.sorted);
        
        if (sortedResults.length !== 2) {
          throw new Error(`Expected 2 results, got ${sortedResults.length}`);
        }
        
        // Merge sorted halves
        const merged = mergeSorted(sortedResults[0], sortedResults[1]);
        const totalThreads = allResults.reduce((sum, r) => sum + r.threadsCreated, 0) + 1;
        
        console.log(`[Depth ${task.depth}] Thread ${threadId} merged ${merged.length} elements`);
        
        pool.terminateAll();
        
        return { 
          threadId, 
          sorted: merged, 
          depth: task.depth,
          taskId: task.taskId,
          threadsCreated: totalThreads
        };
      })
    );
  };
  
  // Serialize the function to pass it along for recursion
  const threadFuncString = threadFunc.toString();
  
  return new ThreadTask(
    threadFunc, 
    of({ 
      array, 
      depth, 
      maxDepth, 
      taskId,
      threadFuncString  // ⭐ Pass function string for recursive calls
    })
  );
}

/**
 * Verify array is sorted
 */
function isSorted(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) return false;
  }
  return true;
}

/**
 * Generate random array
 */
function generateRandomArray(size: number, max: number = 10000): number[] {
  return Array.from({ length: size }, () => Math.floor(Math.random() * max));
}

// Test configuration
const TEST_CASES = [
  { name: 'Small Array, Shallow', size: 5000, maxDepth: 2 },
  { name: 'Medium Array, Medium Depth', size: 20000, maxDepth: 3 },
  { name: 'Large Array, Deep', size: 50000, maxDepth: 4 }
];

async function runTest(testCase: typeof TEST_CASES[0]) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${testCase.name}`);
  console.log(`Array size: ${testCase.size}, Max depth: ${testCase.maxDepth}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Generate test data
  const testArray = generateRandomArray(testCase.size);
  const originalArray = [...testArray];
  
  // Create initial task
  const sortTask = createRecursiveSortTask(testArray, 0, testCase.maxDepth, 'ROOT');
  
  // Create thread pool
  const queue = new ThreadQueue('initial-sort');
  queue.enqueue(sortTask);
  const pool = new ThreadPool([queue]);
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  const result$ = pool.start();
  
  if (!result$) {
    console.error('Failed to start thread pool');
    return;
  }
  
  let finalResult: SortResult | null = null;
  
  await new Promise<void>((resolve, reject) => {
    result$.subscribe({
      next: (result) => {
        if (result.error) {
          console.error('Error:', result.error);
          reject(new Error(result.error));
        } else if (!result.completed && result.value) {
          finalResult = result.value as SortResult;
        }
      },
      error: reject,
      complete: resolve
    });
  });
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const duration = endTime - startTime;
  const memoryUsed = endMemory - startMemory;
  
  pool.terminateAll();
  
  if (!finalResult) {
    console.error('No result received!');
    return;
  }
  
  // TypeScript type assertion - we've confirmed finalResult is not null
  const result: SortResult = finalResult;
  
  // Verify correctness
  const sorted = result.sorted;
  const isCorrect = isSorted(sorted) && sorted.length === originalArray.length;
  
  // Expected sort for verification
  const expectedSort = [...originalArray].sort((a, b) => a - b);
  const matchesExpected = sorted.every((val, idx) => val === expectedSort[idx]);
  
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`✅ Test Results: ${testCase.name}`);
  console.log(`${'-'.repeat(60)}`);
  console.log(`Array size: ${testCase.size}`);
  console.log(`Max recursion depth: ${testCase.maxDepth}`);
  console.log(`Total threads created: ${result.threadsCreated}`);
  console.log(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);
  console.log(`Is sorted: ${isCorrect ? '✅ YES' : '❌ NO'}`);
  console.log(`Matches expected: ${matchesExpected ? '✅ YES' : '❌ NO'}`);
  console.log(`Elements per second: ${Math.floor(testCase.size / (duration / 1000))}`);
  console.log(`${'-'.repeat(60)}\n`);
  
  if (!isCorrect || !matchesExpected) {
    console.error('❌ TEST FAILED: Sort is incorrect!');
    // Show first mismatch
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      if (sorted[i] !== expectedSort[i]) {
        console.error(`Mismatch at index ${i}: got ${sorted[i]}, expected ${expectedSort[i]}`);
        break;
      }
    }
  }
}

// Run all tests sequentially
async function runAllTests() {
  console.log('Starting Recursive Parallel Merge Sort Tests...\n');
  console.log(`System has ${require('os').availableParallelism()} available CPU cores\n`);
  
  const overallStart = Date.now();
  
  for (const testCase of TEST_CASES) {
    try {
      await runTest(testCase);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Test "${testCase.name}" failed:`, error);
    }
  }
  
  const overallDuration = Date.now() - overallStart;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('All Tests Complete!');
  console.log(`Total duration: ${(overallDuration / 1000).toFixed(2)}s`);
  console.log(`${'='.repeat(60)}`);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
