import {Worker} from 'worker_threads';
import {merge, Observable} from 'rxjs';
import * as os from 'os';
import * as path from 'path';
import {ThreadQueue} from './ThreadQueue';
import {AbstractThreadTask} from './AbstractThreadTask';
import {ts} from "./time-stamp";

/**
 * Result emitted by the ThreadPool
 */
export interface ThreadResult<V = any> {
  threadId: number;
  value?: V;
  error?: string;
  completed: boolean;
}

/**
 * ThreadPool manages a pool of worker threads that execute tasks from queues
 */
export class ThreadPool {
  private readonly maxThreads: number;
  private readonly threadQueueArray: ThreadQueue[];
  private readonly activeWorkers: Map<number, Worker>;
  private nextThreadId: number;

  /**
   * Constructor for ThreadPool
   * @param threadQueueArray - Array of ThreadQueue instances containing tasks to execute
   */
  constructor(threadQueueArray: ThreadQueue[]) {
    if (!threadQueueArray || threadQueueArray.length === 0) {
      throw new Error('ThreadPool requires at least one ThreadQueue');
    }

    this.maxThreads = os.availableParallelism();
    this.threadQueueArray = threadQueueArray;
    this.activeWorkers = new Map();
    this.nextThreadId = 0;
  }

  /**
   * Start executing all tasks from all queues
   * @returns Observable that emits results from all threads, or null if no tasks
   */
  start(): Observable<ThreadResult> | null {
    // Concatenate all tasks from all queues into a single list
    const allTasks: AbstractThreadTask[] = [];
    for (const queue of this.threadQueueArray) {
      allTasks.push(...queue.getAllTasks());
    }

    // If no tasks, return null immediately
    if (allTasks.length === 0) {
      return null;
    }

    // Create observables for each thread
    const threadObservables: Observable<ThreadResult>[] = [];

    // Create a worker thread for each task
    for (const task of allTasks) {
      const threadId = this.nextThreadId++;
      const observable = this.createWorkerObservable(task, threadId);
      threadObservables.push(observable);
    }

    // Merge all thread observables into one
    return merge(...threadObservables);
  }

  /**
   * Create an Observable that executes a task in a worker thread
   * @param task - The task to execute
   * @param threadId - Unique thread identifier
   * @returns Observable that emits results from the worker thread
   */
  private createWorkerObservable(
    task: AbstractThreadTask,
    threadId: number
  ): Observable<ThreadResult> {
    return new Observable<ThreadResult>(subscriber => {
      const workerPath = path.join(__dirname, 'worker.js');
      
      // Serialize the thread function to string
      const functionString = task.getThreadFunc().toString();
      console.log(ts() + "functionString: " + functionString);
      
      // Get input data from the task's input observable
      const inputData: any[] = [];
      const inputSubscription = task.getInput().subscribe({
        next: (value) => inputData.push(value),
        complete: () => {
          // Once input is collected, create and start the worker
          console.log(`${ts()}worker.inputData[${threadId}]: ${JSON.stringify(inputData)}`);
          const worker = new Worker(workerPath, {
            workerData: {
              functionString,
              inputData,
              threadId
            }
          });
          console.log(ts() + `worker.started[${threadId}]`);

          this.activeWorkers.set(threadId, worker);

          worker.on('message', (message: any) => {
            if (message.type === 'next') {
              subscriber.next({
                threadId: message.threadId,
                value: message.value,
                completed: false
              });
            } else if (message.type === 'error') {
              subscriber.next({
                threadId: message.threadId,
                error: message.error,
                completed: true
              });
              worker.terminate();
              this.activeWorkers.delete(threadId);
              subscriber.complete();
            } else if (message.type === 'complete') {
              subscriber.next({
                threadId: message.threadId,
                completed: true
              });
              worker.terminate();
              this.activeWorkers.delete(threadId);
              subscriber.complete();
            }
          });

          worker.on('error', (error) => {
            subscriber.next({
              threadId,
              error: error.message,
              completed: true
            });
            this.activeWorkers.delete(threadId);
            subscriber.complete();
          });

          worker.on('exit', (code) => {
            if (code !== 0 && this.activeWorkers.has(threadId)) {
              subscriber.next({
                threadId,
                error: `Worker stopped with exit code ${code}`,
                completed: true
              });
            }
            this.activeWorkers.delete(threadId);
            subscriber.complete();
          });
        },
        error: (error) => {
          subscriber.error(error);
        }
      });

      // Cleanup function
      return () => {
        inputSubscription.unsubscribe();
        const worker = this.activeWorkers.get(threadId);
        if (worker) {
          worker.terminate();
          this.activeWorkers.delete(threadId);
        }
      };
    });
  }

  /**
   * Get the maximum number of threads based on available parallelism
   * @returns Maximum thread count
   */
  getMaxThreads(): number {
    return this.maxThreads;
  }

  /**
   * Get the number of currently active workers
   * @returns Active worker count
   */
  getActiveWorkerCount(): number {
    return this.activeWorkers.size;
  }

  /**
   * Terminate all active workers
   */
  terminateAll(): void {
    for (const [threadId, worker] of this.activeWorkers) {
      worker.terminate();
    }
    this.activeWorkers.clear();
  }
}
