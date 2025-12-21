import * as fs from 'node:fs'
import {mergeMap, Observable, of} from 'rxjs';
import {ThreadPool, ThreadQueue, ThreadTask} from '../index';
import {ts} from "./timestamp";

const CSV_OUTPUT_FILE_NAME_SUFFIX = "-recursive-matrix-multiply.csv";

console.log('=== Recursive Parallel Matrix Multiplication Test ===\n');

interface ResultRecord extends Record<string, any> {
    name: string;
    size: number;
    blockSize: number;
    totalThreadsCreated: number;
    isCorrect: boolean;
    totalOperations: number;
    serialTimeMsec: number;
    parallelTimeMsec: number;
    speedup: number;
    operationsPerSec: number;
}

const csvKeyOrder = [
    "name",
    "size",
    "blockSize",
    "isCorrect",
    "speedup",
    "serialTimeMsec",
    "parallelTimeMsec",
    "totalThreadsCreated",
    "totalOperations",
    "operationsPerSec",
];

const csvResults: Array<ResultRecord> = [];

type Matrix = number[][];

interface MatrixTask {
    a: Matrix;
    b: Matrix;
    depth: number;
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
    return Array.from({length: rows}, () =>
        Array.from({length: cols}, () => Math.floor(Math.random() * max))
    );
}


/**
 * Simple matrix multiplication (for small matrices and verification)
 */
function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
    const rows = a.length;
    const cols = b[0].length;
    const common = b.length;

    const result: Matrix = Array.from({length: rows}, () => Array(cols).fill(0));

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
 * Create recursive matrix multiplication task
 * Note: The thread function must be self-contained (no external closures)
 */
function createRecursiveMatrixTask(
    a: Matrix,
    b: Matrix,
    depth: number,
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
                    const result: any[][] = Array.from({length: rows}, () => Array(cols).fill(0));
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
                    return {topLeft, topRight, bottomLeft, bottomRight};
                }

                function combineMatrix(topLeft: any[][], topRight: any[][], bottomLeft: any[][], bottomRight: any[][]): any[][] {
                    const size = topLeft.length + bottomLeft.length;
                    const result: any[][] = Array.from({length: size}, () => Array(size).fill(0));
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

                // WARNING: Using a MAXIMUM_RECURSION_DEPTH greater than 2 can cause memory exhaustion and swapping. YMMV
                const MAXIMUM_RECURSION_DEPTH = 2;
                const MINIMUM_MATRIX_SPLIT_SIZE = 32;

                // Base case: use direct multiplication
                // Stop if: reached max depth, size is small enough, or matrix too small to split further
                if (task.depth >= MAXIMUM_RECURSION_DEPTH || size <= task.blockSize || size < MINIMUM_MATRIX_SPLIT_SIZE) {
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
                    {a: splitA.topLeft, b: splitB.topLeft, name: 'C11a'},
                    {a: splitA.topLeft, b: splitB.topRight, name: 'C12a'},
                    {a: splitA.topRight, b: splitB.bottomLeft, name: 'C11b'},
                    {a: splitA.topRight, b: splitB.bottomRight, name: 'C12b'},
                    {a: splitA.bottomLeft, b: splitB.topLeft, name: 'C21a'},
                    {a: splitA.bottomLeft, b: splitB.topRight, name: 'C22a'},
                    {a: splitA.bottomRight, b: splitB.bottomLeft, name: 'C21b'},
                    {a: splitA.bottomRight, b: splitB.bottomRight, name: 'C22b'}
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

                // After alphabetical sort: [C11a, C11b, C12a, C12b, C21a, C21b, C22a, C22b]
                // Combine correctly:
                // C11 = C11a + C11b (A11*B11 + A12*B21) = [0] + [1]
                // C12 = C12a + C12b (A11*B12 + A12*B22) = [2] + [3]
                // C21 = C21a + C21b (A21*B11 + A22*B21) = [4] + [5]
                // C22 = C22a + C22b (A21*B12 + A22*B22) = [6] + [7]
                const c11 = addMatrices(subResults[0].result, subResults[1].result);
                const c12 = addMatrices(subResults[2].result, subResults[3].result);
                const c21 = addMatrices(subResults[4].result, subResults[5].result);
                const c22 = addMatrices(subResults[6].result, subResults[7].result);

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

function createTestMatrices(size: number) {
    // Generate test matrices
    console.log('Generating matrices...');
    const matrixA = generateMatrix(size, size, 10);
    const matrixB = generateMatrix(size, size, 10);
    return {matrixA, matrixB};
}

function printPreface(name: string, size: number, blockSize: number) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${name}`);
    console.log(`Matrix size: ${size}x${size}`);
    console.log(`Block size: ${blockSize}x${blockSize}`);
    console.log(`${'='.repeat(60)}\n`);

    // Ensure size is power of 2 for clean splitting
    if ((size & (size - 1)) !== 0) {
        console.warn('Warning: Matrix size is not a power of 2, results may be unexpected\n');
    }
}

interface ExpectedResultTime {
    expected: Matrix;
    expectedTime: number
}

function createExpected(name: string, size: number, blockSize: number, matrixA: Matrix, matrixB: Matrix): ExpectedResultTime {
    // Calculate expected result
    console.log(`Calculating expected result (serial) for ${size}x${size}...`);
    const expectedStart = Date.now();
    const expected = multiplyMatrices(matrixA, matrixB);
    const expectedTime = Date.now() - expectedStart;
    console.log(`Serial multiplication took ${expectedTime}ms\n\n`);
    console.log(`${'='.repeat(60)}\n`);
    return {expected, expectedTime};
}

/**
 * Run a single matrix test
 */
async function runMatrixTest(
    name: string,
    size: number,
    blockSize: number,
    matrixA: Matrix,
    matrixB: Matrix,
    expected: ExpectedResultTime
) {

    // Create parallel task
    const matrixTask = createRecursiveMatrixTask(
        matrixA,
        matrixB,
        0,
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
    const isCorrect = matricesEqual(result.result, expected.expected);
    const speedup = expected.expectedTime / duration;

    const rr: ResultRecord = {
        name,
        size,
        blockSize,
        speedup,
        isCorrect,
        totalThreadsCreated: result.threadsCreated,
        parallelTimeMsec: duration,
        serialTimeMsec: expected.expectedTime,
        operationsPerSec: Math.floor(result.operations / (duration / 1000)),
        totalOperations: result.operations
    }

    csvResults.push(rr);

    console.log(`\n${'-'.repeat(60)}`);
    console.log(`✅ Test Results: ${name}`);
    console.log(`${'-'.repeat(60)}`);
    console.log(`Matrix size: ${size}x${size}`);
    console.log(`Block size: ${blockSize}x${blockSize}`);
    console.log(`Total threads created: ${result.threadsCreated}`);
    console.log(`Total operations: ${result.operations.toLocaleString()}`);
    console.log(`\nPerformance:`);
    console.log(`  Serial time: ${expected.expectedTime}ms`);
    console.log(`  Parallel time: ${duration}ms`);
    console.log(`  Speedup: ${speedup.toFixed(2)}x`);
    console.log(`  Operations/sec: ${rr.operationsPerSec.toLocaleString()}`);
    console.log(`  Memory used: ${memoryUsed.toFixed(2)} MB`);
    console.log(`\nVerification:`);
    console.log(`  Result matches expected: ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`${'-'.repeat(60)}\n`);

}


async function runAllTests() {
    console.log('Starting Recursive Parallel Matrix Multiplication Tests...\n');
    console.log(`System has ${require('os').availableParallelism()} available CPU cores\n`);

    const overallStart = Date.now();

    const tests = [
        {name: "Medium Matrix", size: 256, blocksizes: [16, 32, 64, 128]},
        {name: "Large Matrix", size: 512, blocksizes: [16, 32, 64, 128, 256]},
        {name: "Mega Matrix", size: 1024, blocksizes: [16, 32, 64, 128, 256, 512]},
        {name: "Mega2 Matrix", size: 2048, blocksizes: [16, 32, 64, 128, 256, 512, 1024]},
    ]

    for (const test of tests) {
        const {matrixA, matrixB} = createTestMatrices(test.size);
        let expected: ExpectedResultTime | null = null;
        for (const blockSize of test.blocksizes) {
            printPreface(test.name, test.size, blockSize);
            if (!expected) {
                expected = createExpected(test.name, test.size, blockSize, matrixA, matrixB);
            }
            await runMatrixTest(test.name, test.size, blockSize, matrixA, matrixB, expected);
        }
    }

    const overallDuration = Date.now() - overallStart;

    console.log(`\n${'='.repeat(60)}`);
    console.log('All Matrix Tests Complete!');
    console.log(`Total duration: ${(overallDuration / 1000 / 60).toFixed(2)} minutes`);
    console.log(`${'='.repeat(60)}`);

    const csvOutputFileName = ts() + CSV_OUTPUT_FILE_NAME_SUFFIX;

    let csv = csvKeyOrder.join(',') + "\n";
    for (const rr of csvResults) {
        let l = "";
        for (const key of csvKeyOrder) {
            if (l.length > 0) {
                l += ',';
            }
            l += "" + rr[key];
        }
        csv += l + '\n';
    }
    console.log(`Writing matrix test results to CSV file: ${csvOutputFileName}: ${csv.length} characters`);
    fs.writeFileSync(__dirname + '/../' + csvOutputFileName, csv, 'utf-8');
}

// Run the tests
runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
