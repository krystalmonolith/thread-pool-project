import { spawn } from 'child_process';
import * as path from 'path';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  COMPREHENSIVE RECURSIVE THREADPOOL STRESS TEST SUITE         ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

interface TestConfig {
  name: string;
  file: string;
  description: string;
  estimatedDuration: string;
}

const TESTS: TestConfig[] = [
  {
    name: 'Recursive Merge Sort',
    file: 'recursive-merge-sort.test.js',
    description: 'Tests parallel divide-and-conquer sorting with recursive ThreadPool creation',
    estimatedDuration: '2-3 minutes'
  },
  {
    name: 'Binary Tree Traversal',
    file: 'recursive-tree-traversal.test.js',
    description: 'Tests tree-based recursion with balanced and skewed trees',
    estimatedDuration: '3-4 minutes'
  },
  {
    name: 'Matrix Multiplication',
    file: 'recursive-matrix-multiply.test.js',
    description: 'Tests block-based parallel matrix operations',
    estimatedDuration: '5-10 minutes'
  }
];

/**
 * Run a single test file
 */
function runTest(test: TestConfig): Promise<{ success: boolean; duration: number }> {
  return new Promise((resolve) => {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`STARTING: ${test.name}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`Description: ${test.description}`);
    console.log(`Estimated duration: ${test.estimatedDuration}`);
    console.log(`File: ${test.file}\n`);
    
    const startTime = Date.now();
    const testPath = path.join(__dirname, test.file);
    
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      console.log(`\n${'─'.repeat(70)}`);
      if (success) {
        console.log(`✅ ${test.name} COMPLETED SUCCESSFULLY`);
      } else {
        console.log(`❌ ${test.name} FAILED (exit code: ${code})`);
      }
      console.log(`Duration: ${(duration / 1000 / 60).toFixed(2)} minutes`);
      console.log(`${'─'.repeat(70)}\n`);
      
      resolve({ success, duration });
    });
    
    child.on('error', (error) => {
      console.error(`\n❌ Failed to start test: ${error.message}\n`);
      resolve({ success: false, duration: Date.now() - startTime });
    });
  });
}

/**
 * Run all tests sequentially
 */
async function runAllTests() {
  console.log('System Information:');
  console.log(`  Node.js: ${process.version}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  CPU cores: ${require('os').availableParallelism()}`);
  console.log(`  Total memory: ${(require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`  Free memory: ${(require('os').freemem() / 1024 / 1024 / 1024).toFixed(2)} GB\n`);
  
  const overallStart = Date.now();
  const results: Array<{ test: TestConfig; success: boolean; duration: number }> = [];
  
  for (const test of TESTS) {
    const result = await runTest(test);
    results.push({ test, ...result });
    
    // Wait between tests to allow system to stabilize
    if (test !== TESTS[TESTS.length - 1]) {
      console.log('Waiting 5 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  const overallDuration = Date.now() - overallStart;
  
  // Print summary
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUITE SUMMARY                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  let allPassed = true;
  
  results.forEach(({ test, success, duration }) => {
    const status = success ? '✅ PASS' : '❌ FAIL';
    const time = `${(duration / 1000 / 60).toFixed(2)}m`;
    console.log(`  ${status}  ${test.name.padEnd(25)} ${time}`);
    if (!success) allPassed = false;
  });
  
  console.log(`\n  Total Duration: ${(overallDuration / 1000 / 60).toFixed(2)} minutes`);
  console.log(`  Tests Passed: ${results.filter(r => r.success).length} / ${results.length}`);
  
  if (allPassed) {
    console.log('\n  🎉 ALL TESTS PASSED! 🎉');
    console.log('\n  The ThreadPool framework successfully handled:');
    console.log('    ✓ Recursive ThreadPool creation');
    console.log('    ✓ Deep recursion (up to 10+ levels)');
    console.log('    ✓ Hundreds of concurrent threads');
    console.log('    ✓ Complex computational workloads');
    console.log('    ✓ Proper resource cleanup');
    console.log('    ✓ Correct result verification\n');
  } else {
    console.log('\n  ⚠️  SOME TESTS FAILED\n');
  }
  
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  process.exit(allPassed ? 0 : 1);
}

// Run all tests
runAllTests().catch(error => {
  console.error('\n❌ Fatal error running test suite:', error);
  process.exit(1);
});
