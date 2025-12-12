# Quick Start Guide - Node.js Multi-Threading Framework

## Installation

Extract the tarball and install dependencies:

```bash
tar -xzf node-thread-framework.tar.gz -C my-project
cd my-project
npm install
```

## Build

```bash
npm run build
```

## Run Examples

### Basic Example
```bash
npm test
```

### Advanced Example
```bash
node dist/advanced-example.js
```

## Create Your First Thread Task

```typescript
import { Observable, of, map } from 'rxjs';
import { ThreadTask, ThreadQueue, ThreadPool } from '@yourorg/node-thread-framework';

// 1. Create a thread task
const myTask = new ThreadTask(
  // Thread function - will run in worker thread
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      map(n => ({
        threadId,
        result: n * n  // Square the number
      }))
    );
  },
  // Input data
  of(1, 2, 3, 4, 5)
);

// 2. Create a queue and add task
const queue = new ThreadQueue('my-queue');
queue.enqueue(myTask);

// 3. Create thread pool
const pool = new ThreadPool([queue]);

// 4. Start execution
const result$ = pool.start();

if (result$) {
  result$.subscribe({
    next: (result) => {
      if (!result.error && !result.completed) {
        console.log('Result:', result.value);
      }
    },
    complete: () => {
      console.log('Done!');
      pool.terminateAll();
    }
  });
}
```

## Package Structure

```
src/
  ├── AbstractThreadTask.ts    # Base class for thread tasks
  ├── ThreadQueue.ts           # FIFO queue for tasks
  ├── ThreadPool.ts            # Thread pool manager
  ├── worker.js                # Worker thread script
  ├── index.ts                 # Main exports
  ├── example.ts               # Basic example
  └── advanced-example.ts      # Advanced examples

dist/                          # Compiled JavaScript
package.json                   # NPM package configuration
tsconfig.json                  # TypeScript configuration
README.md                      # Full documentation
```

## Key Concepts

### Thread Function Signature
```typescript
(input: Observable<T>, threadId: number) => Observable<R>
```

- **input**: Stream of input data
- **threadId**: Unique identifier (0, 1, 2, ...)
- **returns**: Observable stream of results

### Multiple Queues

You can organize tasks into multiple queues:

```typescript
const cpuQueue = new ThreadQueue('cpu-intensive');
const ioQueue = new ThreadQueue('io-bound');

cpuQueue.enqueue(task1);
cpuQueue.enqueue(task2);
ioQueue.enqueue(task3);

const pool = new ThreadPool([cpuQueue, ioQueue]);
```

### Thread Count

The pool automatically uses `os.availableParallelism()` to determine the optimal number of threads.

```typescript
console.log(`Using ${pool.getMaxThreads()} threads`);
```

## Best Use Cases

✅ **Good for:**
- Image/video processing
- Data encryption/decryption
- Complex mathematical calculations
- Large dataset transformations
- ML inference
- Compression/decompression

❌ **Not ideal for:**
- Simple I/O operations
- Database queries
- API calls
- File reading/writing

For I/O-bound tasks, Node's async model is more efficient.

## Debugging

Enable error details:
```typescript
result$.subscribe({
  next: (result) => {
    if (result.error) {
      console.error(`Thread ${result.threadId} error:`, result.error);
    }
  }
});
```

## Publishing to NPM

1. Update `package.json` with your organization name
2. Run `npm run build`
3. Test with `npm test`
4. Publish: `npm publish --access public`

## Support

For issues, feature requests, or contributions, please refer to the main README.md file.
