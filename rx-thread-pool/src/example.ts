import { Observable, of, map, delay } from 'rxjs';
import { ThreadTask, ThreadQueue, ThreadPool } from './index';

// Example 1: Simple computational task
const computeTask = new ThreadTask(
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      map(n => {
        // Simulate CPU-intensive work
        let result = 0;
        for (let i = 0; i < n; i++) {
          result += Math.sqrt(i);
        }
        return {
          threadId,
          input: n,
          result
        };
      })
    );
  },
  of(1000000, 2000000, 3000000)
);

// Example 2: Data processing task
const dataProcessingTask = new ThreadTask(
  (input: Observable<string>, threadId: number) => {
    return input.pipe(
      map(str => ({
        threadId,
        original: str,
        processed: str.toUpperCase().split('').reverse().join(''),
        length: str.length
      }))
    );
  },
  of('hello', 'world', 'nodejs', 'multithreading')
);

// Example 3: Async task with delay
const asyncTask = new ThreadTask(
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      delay(1000),
      map(n => ({
        threadId,
        value: n * 2,
        timestamp: new Date().toISOString()
      }))
    );
  },
  of(10, 20, 30)
);

// Create queues
const queue1 = new ThreadQueue('computational-queue');
queue1.enqueue(computeTask);

const queue2 = new ThreadQueue('data-processing-queue');
queue2.enqueue(dataProcessingTask);
queue2.enqueue(asyncTask);

// Create thread pool with multiple queues
const threadPool = new ThreadPool([queue1, queue2]);

console.log(`Max threads available: ${threadPool.getMaxThreads()}`);
console.log('Starting thread pool...\n');

// Start execution
const result$ = threadPool.start();

if (result$) {
  result$.subscribe({
    next: (result) => {
      if (result.error) {
        console.error(`Thread ${result.threadId} error:`, result.error);
      } else if (result.completed) {
        console.log(`Thread ${result.threadId} completed`);
      } else {
        console.log(`Thread ${result.threadId} result:`, result.value);
      }
    },
    error: (error) => {
      console.error('Pool error:', error);
    },
    complete: () => {
      console.log('\nAll threads completed!');
      threadPool.terminateAll();
    }
  });
} else {
  console.log('No tasks to execute');
}
