import { Observable } from 'rxjs';

/**
 * Type definition for the thread function callback
 * @template T - Input observable value type
 * @template I - Input observable type (extends Observable<T>)
 * @template V - Output observable value type
 * @template R - Output observable type (extends Observable<V>)
 */
export type ThreadFunc<
  T,
  I extends Observable<T>,
  V,
  R extends Observable<V>
> = (input: I, threadId: number) => R;

/**
 * Abstract base class for thread tasks
 * Contains a callback function to be executed in a worker thread
 * @template T - Input observable value type
 * @template I - Input observable type
 * @template V - Output observable value type
 * @template R - Output observable type
 */
export abstract class AbstractThreadTask<
  T = any,
  I extends Observable<T> = Observable<any>,
  V = any,
  R extends Observable<V> = Observable<any>
> {
  protected threadFunc: ThreadFunc<T, I, V, R>;
  protected input: I;

  /**
   * Constructor for AbstractThreadTask
   * @param threadFunc - The callback function to execute in the thread
   * @param input - The input observable to pass to the thread function
   */
  protected constructor(threadFunc: ThreadFunc<T, I, V, R>, input: I) {
    this.threadFunc = threadFunc;
    this.input = input;
  }

  /**
   * Get the input observable
   */
  getInput(): I {
    return this.input;
  }

  /**
   * Get the thread function
   */
  getThreadFunc(): ThreadFunc<T, I, V, R> {
    return this.threadFunc;
  }
}

/**
 * Concrete implementation of AbstractThreadTask
 */
export class ThreadTask<
  T = any,
  I extends Observable<T> = Observable<any>,
  V = any,
  R extends Observable<V> = Observable<any>
> extends AbstractThreadTask<T, I, V, R> {
  constructor(threadFunc: ThreadFunc<T, I, V, R>, input: I) {
    super(threadFunc, input);
  }
}
