const { parentPort, workerData } = require('worker_threads');
const rxjs = require('rxjs');
const operators = require('rxjs/operators');

if (parentPort) {
  const { functionString, inputData, threadId } = workerData;

  try {
    // Replace TypeScript compiled rxjs references with actual rxjs module
    // This handles the case where functions are serialized after TypeScript compilation
    let processedFunctionString = functionString;
    
    // Replace all rxjs module references (rxjs_1, rxjs_2, etc.)
    processedFunctionString = processedFunctionString.replace(/rxjs_\d+\./g, 'rxjs.');
    processedFunctionString = processedFunctionString.replace(/operators_\d+\./g, 'operators.');
    
    // Replace import_rxjs, import_rxjs2, etc. patterns (alternative TypeScript compilation)
    processedFunctionString = processedFunctionString.replace(/import_rxjs\d*/g, 'rxjs');
    processedFunctionString = processedFunctionString.replace(/import_operators\d*/g, 'operators');
    
    // Create a context with rxjs available
    const context = {
      rxjs: rxjs,
      operators: operators,
      Observable: rxjs.Observable,
      of: rxjs.of,
      from: rxjs.from,
      map: rxjs.map,
      filter: rxjs.filter,
      reduce: rxjs.reduce,
      delay: rxjs.delay,
      mergeMap: rxjs.mergeMap,
      switchMap: rxjs.switchMap,
      concatMap: rxjs.concatMap,
      tap: rxjs.tap,
      catchError: rxjs.catchError,
      finalize: rxjs.finalize,
      take: rxjs.take,
      skip: rxjs.skip,
      first: rxjs.first,
      last: rxjs.last
    };
    
    // Create function with context
    const functionCreator = new Function(
      ...Object.keys(context),
      `return ${processedFunctionString}`
    );
    
    const threadFunc = functionCreator(...Object.values(context));
    
    // Create input observable from the data
    const input = new rxjs.Observable(subscriber => {
      if (Array.isArray(inputData)) {
        inputData.forEach(item => subscriber.next(item));
      } else if (inputData !== undefined && inputData !== null) {
        subscriber.next(inputData);
      }
      subscriber.complete();
    });

    // Execute the thread function
    const result = threadFunc(input, threadId);

    // Subscribe to the result observable and send values back
    const values = [];
    result.subscribe({
      next: (value) => {
        values.push(value);
        parentPort.postMessage({ type: 'next', value, threadId });
      },
      error: (error) => {
        parentPort.postMessage({ 
          type: 'error', 
          error: error.message || String(error), 
          stack: error.stack,
          threadId 
        });
      },
      complete: () => {
        parentPort.postMessage({ type: 'complete', values, threadId });
      }
    });
  } catch (error) {
    parentPort.postMessage({ 
      type: 'error', 
      error: error.message || String(error),
      stack: error.stack,
      threadId 
    });
  }
}
