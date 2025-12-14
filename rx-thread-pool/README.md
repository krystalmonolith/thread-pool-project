# @krystalmonolith/rx-thread-pool

A multi-threading framework melding Worker Threads and RxJS Observables. This library provides a clean, type-safe interface for executing CPU-intensive tasks in parallel using Node.js Worker Threads.

## Acknowledgments
This project was developed with _significant_ assistance from [Claude](https://claude.ai) (Anthropic).

*"ODNT": Old Dogs, New Tricks!*

## Features

- 🚀 **Worker Thread Pool**: Automatically manages thread pool based on available CPU cores
- 📦 **Type-Safe**: Full TypeScript support with generics
- 🔄 **RxJS Integration**: Built on RxJS v7 Observables for reactive programming
- 📋 **FIFO Queue**: Multiple task queues with first-in-first-out execution
- ⚡ **Parallel Execution**: Execute multiple tasks concurrently across threads
- 🎯 **Thread Tracking**: Unique thread IDs for monitoring and debugging

## Installation

```bash
npm install @krystalmonolith/rx-thread-pool
```

## Requirements

- Node.js >= 16.0.0
- RxJS >= 7.0.0

## Core Classes

### AbstractThreadTask

Abstract base class for creating thread tasks. Contains a callback function that will be executed in a worker thread.

```typescript
class AbstractThreadTask<T, I extends Observable<T>, V, R extends Observable<V>>
```

**Type Parameters:**
- `T` - Input observable value type
- `I` - Input observable type
- `V` - Output observable value type
- `R` - Output observable type

**Methods:**
- `execute(threadId: number): R` - Execute the thread function with the given thread ID

### ThreadTask

Concrete implementation of AbstractThreadTask for creating executable tasks.

```typescript
const task = new ThreadTask(
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      map(n => n * 2)
    );
  },
  of(1, 2, 3, 4, 5)
);
```

### ThreadQueue

FIFO queue for managing ThreadTask instances.

```typescript
const queue = new ThreadQueue('my-queue');
queue.enqueue(task1);
queue.enqueue(task2);
```

**Methods:**
- `enqueue(task)` - Add task to queue
- `dequeue()` - Remove and return first task
- `peek()` - View first task without removing
- `isEmpty()` - Check if queue is empty
- `size()` - Get queue size
- `getAllTasks()` - Get all tasks as array
- `clear()` - Remove all tasks

### ThreadPool

Manages a pool of worker threads that execute tasks from queues.

```typescript
const pool = new ThreadPool([queue1, queue2]);
const result$ = pool.start();
```

**Constructor:**
- Takes array of ThreadQueue instances
- Number of threads = `os.availableParallelism()`

**Methods:**
- `start()` - Start executing all tasks, returns Observable<ThreadResult> or null
- `getMaxThreads()` - Get maximum thread count
- `getActiveWorkerCount()` - Get current active worker count
- `terminateAll()` - Terminate all active workers

## Thread Function Signature

```typescript
threadFunc<T, I extends Observable<T>, V, R extends Observable<V>>(
  input: I,
  threadId: number
): R
```

**Parameters:**
- `input` - Observable input stream
- `threadId` - Unique identifier for the thread (0, 1, 2, ...)

**Returns:**
- Observable stream of results

## Usage Example

```typescript
import { Observable, of, map } from 'rxjs';
import { ThreadTask, ThreadQueue, ThreadPool } from '@krystalmonolith/rx-thread-pool';

// Create a task with a computation function
const computeTask = new ThreadTask(
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      map(n => {
        // CPU-intensive calculation
        let result = 0;
        for (let i = 0; i < n; i++) {
          result += Math.sqrt(i);
        }
        return { threadId, input: n, result };
      })
    );
  },
  of(1000000, 2000000, 3000000)
);

// Create another task
const dataTask = new ThreadTask(
  (input: Observable<string>, threadId: number) => {
    return input.pipe(
      map(str => ({
        threadId,
        processed: str.toUpperCase()
      }))
    );
  },
  of('hello', 'world')
);

// Create queues and add tasks
const queue1 = new ThreadQueue('compute-queue');
queue1.enqueue(computeTask);

const queue2 = new ThreadQueue('data-queue');
queue2.enqueue(dataTask);

// Create thread pool
const pool = new ThreadPool([queue1, queue2]);

// Start execution
const result$ = pool.start();

if (result$) {
  result$.subscribe({
    next: (result) => {
      if (result.error) {
        console.error(`Thread ${result.threadId} error:`, result.error);
      } else if (result.completed) {
        console.log(`Thread ${result.threadId} completed`);
      } else {
        console.log(`Thread ${result.threadId}:`, result.value);
      }
    },
    complete: () => {
      console.log('All threads completed');
      pool.terminateAll();
    }
  });
}
```

## How It Works

1. **Task Creation**: Create ThreadTask instances with a callback function and input Observable
2. **Queue Management**: Add tasks to ThreadQueue instances using FIFO ordering
3. **Pool Initialization**: Create ThreadPool with array of queues
4. **Execution**: Call `pool.start()` to:
   - Concatenate all tasks from all queues
   - Create a worker thread for each task
   - Assign unique thread ID to each worker
   - Return merged Observable of all results
5. **Result Processing**: Subscribe to the result Observable to handle emissions from all threads

## Thread Results

Each result emitted contains:

```typescript
interface ThreadResult<V> {
  threadId: number;      // Unique thread identifier
  value?: V;             // Result value (if not error/complete)
  error?: string;        // Error message (if error occurred)
  completed: boolean;    // true if thread finished
}
```

## Best Practices

1. **CPU-Intensive Tasks**: Use for computationally expensive operations (image processing, data analysis, encryption)
2. **Avoid I/O**: Node's async model is better for I/O operations
3. **Task Granularity**: Balance task size - too small adds overhead, too large reduces parallelism
4. **Memory Management**: Be mindful of data passed between threads
5. **Error Handling**: Always handle errors in subscription

## Limitations

- Functions passed to workers must be serializable (no closures over external variables)
- Shared memory via SharedArrayBuffer is not directly supported (use RxJS streams)
- Worker startup has overhead - better for longer-running tasks

## Building from Source

```bash
npm install
npm run build
```

## Testing

```bash
npm test
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
