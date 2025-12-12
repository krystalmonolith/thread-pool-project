import { AbstractThreadTask } from './AbstractThreadTask';

/**
 * FIFO queue for ThreadTask instances
 * Provides methods to enqueue, dequeue, and manage thread tasks
 */
export class ThreadQueue {
  private queue: AbstractThreadTask[];
  private name: string;

  /**
   * Constructor for ThreadQueue
   * @param name - Optional name for the queue for identification
   */
  constructor(name: string = 'default') {
    this.queue = [];
    this.name = name;
  }

  /**
   * Add a task to the end of the queue
   * @param task - The thread task to enqueue
   */
  enqueue(task: AbstractThreadTask): void {
    this.queue.push(task);
  }

  /**
   * Remove and return the task at the front of the queue
   * @returns The next task or undefined if queue is empty
   */
  dequeue(): AbstractThreadTask | undefined {
    return this.queue.shift();
  }

  /**
   * Get the task at the front of the queue without removing it
   * @returns The next task or undefined if queue is empty
   */
  peek(): AbstractThreadTask | undefined {
    return this.queue[0];
  }

  /**
   * Check if the queue is empty
   * @returns true if queue is empty, false otherwise
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get the number of tasks in the queue
   * @returns The queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get all tasks in the queue
   * @returns Array of all tasks
   */
  getAllTasks(): AbstractThreadTask[] {
    return [...this.queue];
  }

  /**
   * Clear all tasks from the queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get the queue name
   */
  getName(): string {
    return this.name;
  }
}
