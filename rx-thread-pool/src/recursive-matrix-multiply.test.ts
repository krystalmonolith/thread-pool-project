import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs';
import { ThreadTask, ThreadQueue, ThreadPool } from './index';

console.log('=== Recursive Parallel Matrix Multiplication Test ===\n');

type Matrix = number[][];

interface MatrixTask {
  a: Matrix;
  b: Matrix;
  depth: number;
  maxDepth: number;
  blockSize: number;
  taskId: string;
  threadFuncString?: string;  // ⭐ Pass function as string for recursion
}

interface MatrixResult {
  threadId: number;
  result: Matrix;
  depth: number;
  taskId: string;
  threadsCreated: number;
  operations: number;
}

/**
 * Generate a random matrix
 */
function generateMatrix(rows: number, cols: number, max: number = 10): Matrix {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.floor(Math.random() * max))
  );
}

/**
 * Generate identity matrix
 */
function identityMatrix(size: number): Matrix {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => i === j ? 1 : 0)
  );
}

/**
 * Simple matrix multiplication (for small matrices and verification)
 */
function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const cols = b[0].length;
  const common = b.length;
  
  const result: Matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < common; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  
  return result;
}

/**
 * Add two matrices
 */
function addMatrices(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((val, j) => val + b[i][j]));
}

/**
 * Split matrix into quadrants
 */
function splitMatrix(m: Matrix): {
  topLeft: Matrix;
  topRight: Matrix;
  bottomLeft: Matrix;
  bottomRight: Matrix;
} {
  const size = m.length;
  const mid = Math.floor(size / 2);
  
  const topLeft: Matrix = [];
  const topRight: Matrix = [];
  const bottomLeft: Matrix = [];
  const bottomRight: Matrix = [];
  
  for (let i = 0; i < mid; i++) {
    topLeft.push(m[i].slice(0, mid));
    topRight.push(m[i].slice(mid));
  }
  
  for (let i = mid; i < size; i++) {
    bottomLeft.push(m[i].slice(0, mid));
    bottomRight.push(m[i].slice(mid));
  }
  
  return { topLeft, topRight, bottomLeft, bottomRight };
}

/**
 * Combine quadrants into a matrix
 */
function combineMatrix(
  topLeft: Matrix,
  topRight: Matrix,
  bottomLeft: Matrix,
  bottomRight: Matrix
): Matrix {
  const size = topLeft.length + bottomLeft.length;
  const result: Matrix = Array.from({ length: size }, () => Array(size).fill(0));
  
  const mid = topLeft.length;
  
  // Top half
  for (let i = 0; i < mid; i++) {
    for (let j = 0; j < mid; j++) {
      result[i][j] = topLeft[i][j];
      result[i][j + mid] = topRight[i][j];
    }
  }
  
  // Bottom half
  for (let i = 0; i < bottomLeft.length; i++) {
    for (let j = 0; j < mid; j++) {
      result[i + mid][j] = bottomLeft[i][j];
      result[i + mid][j + mid] = bottomRight[i][j];
    }
  }
  
  return result;
}

/**
 * Count operations in matrix multiplication
 */
function countOperations(rows: number, cols: number, common: number): number {
  return rows * cols * common;
}

/**
 * Create recursive matrix multiplication task
 * Note: The thread function must be self-contained (no external closures)
 */
function createRecursiveMatrixTask(
  a: Matrix,
  b: Matrix,
  depth: number,
  maxDepth: number,
  blockSize: number,
  taskId: string
): ThreadTask {
  // Thread function that will be serialized - must be completely self-contained
  const threadFunc = (input: Observable<MatrixTask>, threadId: number) => {
    return input.pipe(
      mergeMap(async (task) => {
        // ThreadTask, ThreadQueue, ThreadPool, of, mergeMap are available in worker context
        
        const size = task.a.length;
        console.log(`[Depth ${task.depth}] Thread ${threadId} multiplying ${size}x${size} matrices (task: ${task.taskId})`);
        
        // Helper functions defined in worker scope
        function multiplyMatrices(a: any[][], b: any[][]): any[][] {
          const rows = a.length;
          const cols = b[0].length;
          const common = b.length;
          const result: any[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
              for (let k = 0; k < common; k++) {
                result[i][j] += a[i][k] * b[k][j];
              }
            }
          }
          return result;
        }
        
        function addMatrices(a: any[][], b: any[][]): any[][] {
          return a.map((row, i) => row.map((val, j) => val + b[i][j]));
        }
        
        function splitMatrix(m: any[][]) {
          const size = m.length;
          const mid = Math.floor(size / 2);
          const topLeft: any[][] = [];
          const topRight: any[][] = [];
          const bottomLeft: any[][] = [];
          const bottomRight: any[][] = [];
          for (let i = 0; i < mid; i++) {
            topLeft.push(m[i].slice(0, mid));
            topRight.push(m[i].slice(mid));
          }
          for (let i = mid; i < size; i++) {
            bottomLeft.push(m[i].slice(0, mid));
            bottomRight.push(m[i].slice(mid));
          }
          return { topLeft, topRight, bottomLeft, bottomRight };
        }
        
        function combineMatrix(topLeft: any[][], topRight: any[][], bottomLeft: any[][], bottomRight: any[][]): any[][] {
          const size = topLeft.length + bottomLeft.length;
          const result: any[][] = Array.from({ length: size }, () => Array(size).fill(0));
          const mid = topLeft.length;
          for (let i = 0; i < mid; i++) {
            for (let j = 0; j < mid; j++) {
              result[i][j] = topLeft[i][j];
              result[i][j + mid] = topRight[i][j];
            }
          }
          for (let i = 0; i < bottomLeft.length; i++) {
            for (let j = 0; j < mid; j++) {
              result[i + mid][j] = bottomLeft[i][j];
              result[i + mid][j + mid] = bottomRight[i][j];
            }
          }
          return result;
        }
        
        function countOperations(rows: number, cols: number, common: number): number {
          return rows * cols * common;
        }
        
        // Base case: use direct multiplication
        if (task.depth >= task.maxDepth || size <= task.blockSize) {
          const result = multiplyMatrices(task.a, task.b);
          const ops = countOperations(size, size, size);
          console.log(`[Depth ${task.depth}] Thread ${threadId} completed ${size}x${size} multiplication (${ops} ops)`);
          
          return {
            threadId,
            result,
            depth: task.depth,
            taskId: task.taskId,
            threadsCreated: 1,
            operations: ops
          };
        }
        
        // Recursive case: divide into blocks
        console.log(`[Depth ${task.depth}] Thread ${threadId} splitting ${size}x${size} into quadrants`);
        
        const splitA = splitMatrix(task.a);
        const splitB = splitMatrix(task.b);
        
        // Create 8 multiplication tasks
        const tasks = [
          { a: splitA.topLeft, b: splitB.topLeft, name: 'C11a' },
          { a: splitA.topLeft, b: splitB.topRight, name: 'C12a' },
          { a: splitA.topRight, b: splitB.bottomLeft, name: 'C11b' },
          { a: splitA.topRight, b: splitB.bottomRight, name: 'C12b' },
          { a: splitA.bottomLeft, b: splitB.topLeft, name: 'C21a' },
          { a: splitA.bottomLeft, b: splitB.topRight, name: 'C22a' },
          { a: splitA.bottomRight, b: splitB.bottomLeft, name: 'C21b' },
          { a: splitA.bottomRight, b: splitB.bottomRight, name: 'C22b' }
        ];
        
        const queue = new ThreadQueue(`matrix-depth-${task.depth}`);
        
        // Reconstruct the function from the passed string for recursion
        const funcString = task.threadFuncString || '';
        const recreatedFunc = new Function('input', 'threadId', 
          'return (' + funcString + ')(input, threadId)'
        );
        
        tasks.forEach((t) => {
          const subTask = new ThreadTask(
            recreatedFunc as any,
            of({ 
              a: t.a, 
              b: t.b, 
              depth: task.depth + 1, 
              maxDepth: task.maxDepth, 
              blockSize: task.blockSize, 
              taskId: `${task.taskId}-${t.name}`,
              threadFuncString: funcString
            })
          );
          queue.enqueue(subTask);
        });
        
        const pool = new ThreadPool([queue]);
        const results$ = pool.start();
        
        if (!results$) {
          throw new Error('Failed to start thread pool');
        }
        
        const subResults: any[] = [];
        
        await new Promise<void>((resolve, reject) => {
          results$.subscribe({
            next: (result: any) => {
              if (result.error) {
                console.error(`[Depth ${task.depth}] Error in sub-task:`, result.error);
                reject(new Error(result.error));
              } else if (!result.completed && result.value) {
                subResults.push(result.value);
              }
            },
            error: reject,
            complete: resolve
          });
        });
        
        if (subResults.length !== 8) {
          throw new Error(`Expected 8 results, got ${subResults.length}`);
        }
        
        // Sort results by task name to maintain order
        subResults.sort((a, b) => a.taskId.localeCompare(b.taskId));
        
        // Combine results
        const c11 = addMatrices(subResults[0].result, subResults[2].result);
        const c12 = addMatrices(subResults[1].result, subResults[3].result);
        const c21 = addMatrices(subResults[4].result, subResults[6].result);
        const c22 = addMatrices(subResults[5].result, subResults[7].result);
        
        const result = combineMatrix(c11, c12, c21, c22);
        const totalThreads = subResults.reduce((sum, r) => sum + r.threadsCreated, 0) + 1;
        const totalOps = subResults.reduce((sum, r) => sum + r.operations, 0);
        
        console.log(`[Depth ${task.depth}] Thread ${threadId} combined ${size}x${size} result`);
        
        pool.terminateAll();
        
        return {
          threadId,
          result,
          depth: task.depth,
          taskId: task.taskId,
          threadsCreated: totalThreads,
          operations: totalOps
        };
      })
    );
  };
  
  // Serialize the function to pass it along for recursion
  const threadFuncString = threadFunc.toString();
  
  return new ThreadTask(
    threadFunc,
    of({ 
      a, 
      b, 
      depth, 
      maxDepth, 
      blockSize, 
      taskId,
      threadFuncString  // ⭐ Pass function string for recursive calls
    })
  );
}

/**
 * Compare two matrices for equality (with tolerance for floating point)
 */
function matricesEqual(a: Matrix, b: Matrix, tolerance: number = 0.0001): boolean {
  if (a.length !== b.length || a[0].length !== b[0].length) return false;
  
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[0].length; j++) {
      if (Math.abs(a[i][j] - b[i][j]) > tolerance) {
        console.error(`Mismatch at [${i}][${j}]: ${a[i][j]} vs ${b[i][j]}`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Run a single matrix test
 */
async function runMatrixTest(
  name: string,
  size: number,
  maxDepth: number,
  blockSize: number
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${name}`);
  console.log(`Matrix size: ${size}x${size}`);
  console.log(`Max recursion depth: ${maxDepth}`);
  console.log(`Block size: ${blockSize}x${blockSize}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Ensure size is power of 2 for clean splitting
  if ((size & (size - 1)) !== 0) {
    console.warn('Warning: Matrix size is not a power of 2, results may be unexpected\n');
  }
  
  // Generate test matrices
  console.log('Generating matrices...');
  const matrixA = generateMatrix(size, size, 10);
  const matrixB = generateMatrix(size, size, 10);
  
  // Calculate expected result
  console.log('Calculating expected result (serial)...');
  const expectedStart = Date.now();
  const expected = multiplyMatrices(matrixA, matrixB);
  const expectedTime = Date.now() - expectedStart;
  console.log(`Serial multiplication took ${expectedTime}ms\n`);
  
  // Create parallel task
  const matrixTask = createRecursiveMatrixTask(
    matrixA,
    matrixB,
    0,
    maxDepth,
    blockSize,
    'ROOT'
  );
  
  // Create thread pool
  const queue = new ThreadQueue('matrix-multiply');
  queue.enqueue(matrixTask);
  const pool = new ThreadPool([queue]);
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  const result$ = pool.start();
  
  if (!result$) {
    console.error('Failed to start thread pool');
    return;
  }
  
  let finalResult: MatrixResult | null = null;
  
  await new Promise<void>((resolve, reject) => {
    result$.subscribe({
      next: (result) => {
        if (result.error) {
          console.error('Error:', result.error);
          reject(new Error(result.error));
        } else if (!result.completed && result.value) {
          finalResult = result.value as MatrixResult;
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
  const result: MatrixResult = finalResult;
  
  // Verify correctness
  const isCorrect = matricesEqual(result.result, expected);
  const speedup = expectedTime / duration;
  
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`✅ Test Results: ${name}`);
  console.log(`${'-'.repeat(60)}`);
  console.log(`Matrix size: ${size}x${size}`);
  console.log(`Max recursion depth: ${maxDepth}`);
  console.log(`Block size: ${blockSize}x${blockSize}`);
  console.log(`Total threads created: ${result.threadsCreated}`);
  console.log(`Total operations: ${result.operations.toLocaleString()}`);
  console.log(`\nPerformance:`);
  console.log(`  Serial time: ${expectedTime}ms`);
  console.log(`  Parallel time: ${duration}ms`);
  console.log(`  Speedup: ${speedup.toFixed(2)}x`);
  console.log(`  Operations/sec: ${Math.floor(result.operations / (duration / 1000)).toLocaleString()}`);
  console.log(`  Memory used: ${memoryUsed.toFixed(2)} MB`);
  console.log(`\nVerification:`);
  console.log(`  Result matches expected: ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`${'-'.repeat(60)}\n`);
}

// Run all tests
async function runAllTests() {
  console.log('Starting Recursive Parallel Matrix Multiplication Tests...\n');
  console.log(`System has ${require('os').availableParallelism()} available CPU cores\n`);
  
  const overallStart = Date.now();
  
  // Test 1: Small matrix, shallow recursion
  await runMatrixTest('Small Matrix', 64, 2, 16);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Medium matrix, medium recursion
  await runMatrixTest('Medium Matrix', 128, 2, 32);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Large matrix, deeper recursion
  await runMatrixTest('Large Matrix', 256, 3, 32);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Extra large (if system can handle it)
  await runMatrixTest('Extra Large Matrix', 512, 3, 64);
  
  const overallDuration = Date.now() - overallStart;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('All Matrix Tests Complete!');
  console.log(`Total duration: ${(overallDuration / 1000 / 60).toFixed(2)} minutes`);
  console.log(`${'='.repeat(60)}`);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
