import {map, Observable, of} from 'rxjs';
import {ThreadPool, ThreadQueue, ThreadTask} from './index';

console.log('=== Advanced Multi-Threading Framework Examples ===\n');

// Example 1: Prime number calculation (CPU intensive)
const primeTask = new ThreadTask(
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      map(limit => {
        const isPrime = (num: number): boolean => {
          if (num <= 1) return false;
          if (num <= 3) return true;
          if (num % 2 === 0 || num % 3 === 0) return false;
          for (let i = 5; i * i <= num; i += 6) {
            if (num % i === 0 || num % (i + 2) === 0) return false;
          }
          return true;
        };

        const primes: number[] = [];
        for (let i = 2; i < limit; i++) {
          if (isPrime(i)) primes.push(i);
        }

        return {
          threadId,
          limit,
          primeCount: primes.length,
          lastPrime: primes[primes.length - 1]
        };
      })
    );
  },
  of(1000, 5000, 10000)
);

// Example 2: Array statistics calculation
const statsTask = new ThreadTask(
  (input: Observable<number[]>, threadId: number) => {
    return input.pipe(
      map(arr => {
        const sum = arr.reduce((a, b) => a + b, 0);
        const mean = sum / arr.length;
        const sorted = [...arr].sort((a, b) => a - b);
        const median = arr.length % 2 === 0
          ? (sorted[arr.length / 2 - 1] + sorted[arr.length / 2]) / 2
          : sorted[Math.floor(arr.length / 2)];

        return {
          threadId,
          count: arr.length,
          sum,
          mean,
          median,
          min: Math.min(...arr),
          max: Math.max(...arr)
        };
      })
    );
  },
  of(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [100, 200, 150, 175, 225, 250],
    [5, 15, 25, 35, 45, 55, 65, 75, 85, 95]
  )
);

// Example 3: Text analysis
const textAnalysisTask = new ThreadTask(
  (input: Observable<string>, threadId: number) => {
    return input.pipe(
      map(text => {
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        const wordFreq: { [key: string]: number } = {};
        words.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        const uniqueWords = Object.keys(wordFreq).length;
        const mostCommon = Object.entries(wordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        return {
          threadId,
          text: text.substring(0, 50) + '...',
          totalWords: words.length,
          uniqueWords,
          avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length,
          mostCommon
        };
      })
    );
  },
  of(
    'The quick brown fox jumps over the lazy dog. The dog was very lazy indeed.',
    'Node.js is a JavaScript runtime built on Chrome V8 engine. Node.js uses an event-driven, non-blocking I/O model.',
    'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. TypeScript adds optional types to JavaScript.'
  )
);

// Example 4: Fibonacci sequence (recursive calculation)
const fibonacciTask = new ThreadTask(
  (input: Observable<number>, threadId: number) => {
    return input.pipe(
      map(n => {
        const fib = (num: number): number => {
          if (num <= 1) return num;
          let a = 0, b = 1;
          for (let i = 2; i <= num; i++) {
            const temp = a + b;
            a = b;
            b = temp;
          }
          return b;
        };

        const start = Date.now();
        const result = fib(n);
        const duration = Date.now() - start;

        return {
          threadId,
          n,
          result,
          duration: `${duration}ms`
        };
      })
    );
  },
  of(30, 35, 40, 45)
);

// Create queues for different task types
const computeQueue = new ThreadQueue('compute-intensive');
computeQueue.enqueue(primeTask);
computeQueue.enqueue(fibonacciTask);

const analysisQueue = new ThreadQueue('analysis');
analysisQueue.enqueue(statsTask);
analysisQueue.enqueue(textAnalysisTask);

// Create and start thread pool
const pool = new ThreadPool([computeQueue, analysisQueue]);

console.log(`System has ${pool.getMaxThreads()} available CPU cores`);
console.log(`Starting ${computeQueue.size() + analysisQueue.size()} tasks across multiple queues\n`);

const startTime = Date.now();
const result$ = pool.start();

if (result$) {
  let completedThreads = 0;
  let totalResults = 0;

  result$.subscribe({
    next: (result) => {
      if (result.error) {
        console.error(`❌ Thread ${result.threadId} error:`, result.error);
      } else if (result.completed) {
        completedThreads++;
        console.log(`✅ Thread ${result.threadId} completed`);
      } else {
        totalResults++;
        console.log(`📊 Thread ${result.threadId}:`, JSON.stringify(result.value, null, 2));
      }
    },
    error: (error) => {
      console.error('Pool error:', error);
    },
    complete: () => {
      const duration = Date.now() - startTime;
      console.log('\n=== Execution Summary ===');
      console.log(`Total threads: ${completedThreads}`);
      console.log(`Total results: ${totalResults}`);
      console.log(`Execution time: ${duration}ms`);
      console.log(`Active workers at completion: ${pool.getActiveWorkerCount()}`);
      
      pool.terminateAll();
      console.log('\nAll workers terminated. Framework test complete! ✨');
    }
  });
} else {
  console.log('No tasks to execute');
}
