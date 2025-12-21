import {mergeMap, Observable, of} from 'rxjs';
import {ThreadPool, ThreadQueue, ThreadTask} from '../index';

console.log('=== Recursive Binary Tree Traversal Test ===\n');

interface TreeNode {
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
  depth: number;
}

interface TreeTask {
  node: TreeNode | null;
  maxDepth: number;
  currentDepth: number;
  taskId: string;
  threadFuncString?: string;  // ⭐ Pass function as string for recursion
}

interface TreeResult {
  threadId: number;
  sum: number;
  count: number;
  maxValue: number;
  minValue: number;
  depth: number;
  taskId: string;
  threadsCreated: number;
}

/**
 * Generate a balanced binary tree
 */
function generateBalancedTree(depth: number, currentDepth: number = 0): TreeNode | null {
  if (currentDepth >= depth) return null;
  
  const value = Math.floor(Math.random() * 1000) + 1;
  
  return {
    value,
    left: generateBalancedTree(depth, currentDepth + 1),
    right: generateBalancedTree(depth, currentDepth + 1),
    depth: currentDepth
  };
}

/**
 * Generate a skewed binary tree (for testing unbalanced workload)
 */
function generateSkewedTree(depth: number, currentDepth: number = 0, skewRight: boolean = true): TreeNode | null {
  if (currentDepth >= depth) return null;
  
  const value = Math.floor(Math.random() * 1000) + 1;
  
  if (skewRight) {
    return {
      value,
      left: null,
      right: generateSkewedTree(depth, currentDepth + 1, skewRight),
      depth: currentDepth
    };
  } else {
    return {
      value,
      left: generateSkewedTree(depth, currentDepth + 1, skewRight),
      right: null,
      depth: currentDepth
    };
  }
}

/**
 * Count total nodes in tree (for verification)
 */
function countNodes(node: TreeNode | null): number {
  if (!node) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

/**
 * Calculate tree statistics serially (for verification)
 */
function calculateTreeStats(node: TreeNode | null): { sum: number; count: number; max: number; min: number } {
  if (!node) return { sum: 0, count: 0, max: -Infinity, min: Infinity };
  
  const leftStats = calculateTreeStats(node.left);
  const rightStats = calculateTreeStats(node.right);
  
  return {
    sum: node.value + leftStats.sum + rightStats.sum,
    count: 1 + leftStats.count + rightStats.count,
    max: Math.max(node.value, leftStats.max, rightStats.max),
    min: Math.min(node.value, leftStats.min, rightStats.min)
  };
}

/**
 * Create a recursive tree traversal task
 * Note: The thread function must be self-contained (no external closures)
 */
function createRecursiveTreeTask(
  node: TreeNode | null,
  maxDepth: number,
  currentDepth: number,
  taskId: string
): ThreadTask {
  // Thread function that will be serialized - must be completely self-contained
  const threadFunc = (input: Observable<TreeTask>, threadId: number) => {
    return input.pipe(
      mergeMap(async (task) => {
        // ThreadTask, ThreadQueue, ThreadPool, of, mergeMap are available in worker context
        
        console.log(`[Depth ${task.currentDepth}] Thread ${threadId} processing node (task: ${task.taskId})`);
        
        // Helper function to calculate tree stats serially (defined in worker scope)
        function calculateTreeStats(node: any): { sum: number; count: number; max: number; min: number } {
          if (!node) return { sum: 0, count: 0, max: -Infinity, min: Infinity };
          
          const leftStats = calculateTreeStats(node.left);
          const rightStats = calculateTreeStats(node.right);
          
          return {
            sum: node.value + leftStats.sum + rightStats.sum,
            count: 1 + leftStats.count + rightStats.count,
            max: Math.max(node.value, leftStats.max, rightStats.max),
            min: Math.min(node.value, leftStats.min, rightStats.min)
          };
        }
        
        // Base case: null node
        if (!task.node) {
          return {
            threadId,
            sum: 0,
            count: 0,
            maxValue: -Infinity,
            minValue: Infinity,
            depth: task.currentDepth,
            taskId: task.taskId,
            threadsCreated: 1
          };
        }
        
        const nodeValue = task.node.value;
        
        // Base case: leaf node or max depth reached
        if (task.currentDepth >= task.maxDepth || (!task.node.left && !task.node.right)) {
          // Process this subtree serially
          const stats = calculateTreeStats(task.node);
          console.log(`[Depth ${task.currentDepth}] Thread ${threadId} completed leaf processing: ${stats.count} nodes`);
          
          return {
            threadId,
            sum: stats.sum,
            count: stats.count,
            maxValue: stats.max,
            minValue: stats.min,
            depth: task.currentDepth,
            taskId: task.taskId,
            threadsCreated: 1
          };
        }
        
        // Recursive case: create ThreadPool for children
        console.log(`[Depth ${task.currentDepth}] Thread ${threadId} spawning child threads`);
        
        // Reconstruct the function from the passed string for recursion
        const funcString = task.threadFuncString || '';
        const recreatedFunc = new Function('input', 'threadId', 
          'return (' + funcString + ')(input, threadId)'
        );
        
        const childTasks: any[] = [];
        
        if (task.node.left) {
          childTasks.push(new ThreadTask(
            recreatedFunc as any,
            of({ 
              node: task.node.left, 
              maxDepth: task.maxDepth, 
              currentDepth: task.currentDepth + 1, 
              taskId: `${task.taskId}-L`,
              threadFuncString: funcString
            })
          ));
        }
        
        if (task.node.right) {
          childTasks.push(new ThreadTask(
            recreatedFunc as any,
            of({ 
              node: task.node.right, 
              maxDepth: task.maxDepth, 
              currentDepth: task.currentDepth + 1, 
              taskId: `${task.taskId}-R`,
              threadFuncString: funcString
            })
          ));
        }
        
        if (childTasks.length === 0) {
          // Only current node
          return {
            threadId,
            sum: nodeValue,
            count: 1,
            maxValue: nodeValue,
            minValue: nodeValue,
            depth: task.currentDepth,
            taskId: task.taskId,
            threadsCreated: 1
          };
        }
        
        // Create ThreadPool for children
        const queue = new ThreadQueue(`tree-depth-${task.currentDepth}`);
        childTasks.forEach(t => queue.enqueue(t));
        
        const pool = new ThreadPool([queue]);
        const results$ = pool.start();
        
        if (!results$) {
          throw new Error('Failed to start thread pool');
        }
        
        // Collect results
        const childResults: any[] = [];
        
        await new Promise<void>((resolve, reject) => {
          results$.subscribe({
            next: (result: any) => {
              if (result.error) {
                console.error(`[Depth ${task.currentDepth}] Error in child:`, result.error);
                reject(new Error(result.error));
              } else if (!result.completed && result.value) {
                childResults.push(result.value);
              }
            },
            error: reject,
            complete: resolve
          });
        });
        
        // Combine results from children
        const totalSum = nodeValue + childResults.reduce((sum, r) => sum + r.sum, 0);
        const totalCount = 1 + childResults.reduce((sum, r) => sum + r.count, 0);
        const maxValue = Math.max(nodeValue, ...childResults.map(r => r.maxValue));
        const minValue = Math.min(nodeValue, ...childResults.map(r => r.minValue));
        const totalThreads = childResults.reduce((sum, r) => sum + r.threadsCreated, 0) + 1;
        
        console.log(`[Depth ${task.currentDepth}] Thread ${threadId} combined results: ${totalCount} nodes processed`);
        
        pool.terminateAll();
        
        return {
          threadId,
          sum: totalSum,
          count: totalCount,
          maxValue,
          minValue,
          depth: task.currentDepth,
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
      node, 
      maxDepth, 
      currentDepth, 
      taskId,
      threadFuncString  // ⭐ Pass function string for recursive calls
    })
  );
}

/**
 * Run a single tree test
 */
async function runTreeTest(
  name: string,
  tree: TreeNode | null,
  maxDepth: number
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test: ${name}`);
  console.log(`Max recursion depth: ${maxDepth}`);
  console.log(`${'='.repeat(60)}\n`);
  
  if (!tree) {
    console.log('Empty tree, skipping...\n');
    return;
  }
  
  // Get expected results
  const expectedStats = calculateTreeStats(tree);
  const nodeCount = countNodes(tree);
  
  console.log(`Tree has ${nodeCount} nodes`);
  console.log(`Expected: sum=${expectedStats.sum}, max=${expectedStats.max}, min=${expectedStats.min}\n`);
  
  // Create task
  const treeTask = createRecursiveTreeTask(tree, maxDepth, 0, 'ROOT');
  
  // Create thread pool
  const queue = new ThreadQueue('tree-traversal');
  queue.enqueue(treeTask);
  const pool = new ThreadPool([queue]);
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  const result$ = pool.start();
  
  if (!result$) {
    console.error('Failed to start thread pool');
    return;
  }
  
  let finalResult: TreeResult | null = null;
  
  await new Promise<void>((resolve, reject) => {
    result$.subscribe({
      next: (result) => {
        if (result.error) {
          console.error('Error:', result.error);
          reject(new Error(result.error));
        } else if (!result.completed && result.value) {
          finalResult = result.value as TreeResult;
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
  const result: TreeResult = finalResult;
  
  // Verify correctness
  const sumCorrect = result.sum === expectedStats.sum;
  const countCorrect = result.count === expectedStats.count;
  const maxCorrect = result.maxValue === expectedStats.max;
  const minCorrect = result.minValue === expectedStats.min;
  const allCorrect = sumCorrect && countCorrect && maxCorrect && minCorrect;
  
  console.log(`\n${'-'.repeat(60)}`);
  console.log(`✅ Test Results: ${name}`);
  console.log(`${'-'.repeat(60)}`);
  console.log(`Nodes processed: ${result.count} / ${nodeCount}`);
  console.log(`Total threads created: ${result.threadsCreated}`);
  console.log(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);
  console.log(`Nodes per second: ${Math.floor(result.count / (duration / 1000))}`);
  console.log(`\nVerification:`);
  console.log(`  Sum: ${result.sum} ${sumCorrect ? '✅' : '❌'} (expected: ${expectedStats.sum})`);
  console.log(`  Count: ${result.count} ${countCorrect ? '✅' : '❌'} (expected: ${expectedStats.count})`);
  console.log(`  Max: ${result.maxValue} ${maxCorrect ? '✅' : '❌'} (expected: ${expectedStats.max})`);
  console.log(`  Min: ${result.minValue} ${minCorrect ? '✅' : '❌'} (expected: ${expectedStats.min})`);
  console.log(`  Overall: ${allCorrect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`${'-'.repeat(60)}\n`);
}

// Run all tests
async function runAllTests() {
  console.log('Starting Recursive Binary Tree Traversal Tests...\n');
  console.log(`System has ${require('os').availableParallelism()} available CPU cores\n`);
  
  const overallStart = Date.now();
  
  // Test 1: Small balanced tree
  console.log('Generating small balanced tree (depth 6)...');
  const smallBalanced = generateBalancedTree(6);
  await runTreeTest('Small Balanced Tree', smallBalanced, 3);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Medium balanced tree
  console.log('Generating medium balanced tree (depth 8)...');
  const mediumBalanced = generateBalancedTree(8);
  await runTreeTest('Medium Balanced Tree', mediumBalanced, 4);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Large balanced tree
  console.log('Generating large balanced tree (depth 10)...');
  const largeBalanced = generateBalancedTree(10);
  await runTreeTest('Large Balanced Tree', largeBalanced, 5);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Skewed tree (right)
  console.log('Generating skewed tree (depth 20, right-skewed)...');
  const skewedRight = generateSkewedTree(20, 0, true);
  await runTreeTest('Right-Skewed Tree', skewedRight, 5);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const overallDuration = Date.now() - overallStart;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('All Tree Tests Complete!');
  console.log(`Total duration: ${(overallDuration / 1000).toFixed(2)}s`);
  console.log(`${'='.repeat(60)}`);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
