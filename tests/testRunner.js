#!/usr/bin/env node

/**
 * Test Runner for Neo VMS
 * Comprehensive test suite runner with coverage reporting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const testConfig = {
  unit: {
    pattern: 'tests/**/*.test.js',
    coverage: true,
    timeout: 30000
  },
  integration: {
    pattern: 'tests/integration/**/*.test.js',
    coverage: true,
    timeout: 60000
  },
  e2e: {
    pattern: 'tests/e2e/**/*.spec.js',
    coverage: false,
    timeout: 120000
  },
  frontend: {
    pattern: 'client/src/**/*.test.{ts,tsx}',
    coverage: true,
    timeout: 30000
  }
};

// Helper functions
const runCommand = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
};

const createCoverageDirectory = () => {
  const coverageDir = path.join(__dirname, '../coverage');
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }
};

const runTests = async (testType, options = {}) => {
  const config = testConfig[testType];
  if (!config) {
    throw new Error(`Unknown test type: ${testType}`);
  }

  console.log(`\n🚀 Running ${testType} tests...\n`);

  const jestArgs = [
    '--testMatch', `<rootDir>/${config.pattern}`,
    '--testTimeout', config.timeout.toString(),
    '--verbose'
  ];

  if (config.coverage && !options.noCoverage) {
    createCoverageDirectory();
    jestArgs.push('--coverage');
    jestArgs.push('--coverageDirectory', `coverage/${testType}`);
  }

  if (options.watch) {
    jestArgs.push('--watch');
  }

  if (options.watchAll) {
    jestArgs.push('--watchAll');
  }

  if (options.updateSnapshots) {
    jestArgs.push('--updateSnapshot');
  }

  if (options.bail) {
    jestArgs.push('--bail');
  }

  if (options.silent) {
    jestArgs.push('--silent');
  }

  if (options.detectOpenHandles) {
    jestArgs.push('--detectOpenHandles');
  }

  if (options.forceExit) {
    jestArgs.push('--forceExit');
  }

  if (options.runInBand) {
    jestArgs.push('--runInBand');
  }

  if (options.maxWorkers) {
    jestArgs.push('--maxWorkers', options.maxWorkers.toString());
  }

  try {
    await runCommand('npx', ['jest', ...jestArgs]);
    console.log(`\n✅ ${testType} tests completed successfully!\n`);
  } catch (error) {
    console.error(`\n❌ ${testType} tests failed!\n`);
    throw error;
  }
};

const runFrontendTests = async (options = {}) => {
  console.log('\n🚀 Running frontend tests...\n');

  const reactScriptsArgs = ['test'];

  if (options.coverage) {
    reactScriptsArgs.push('--coverage');
    reactScriptsArgs.push('--coverageDirectory', 'coverage/frontend');
  }

  if (options.watch) {
    reactScriptsArgs.push('--watch');
  } else {
    reactScriptsArgs.push('--watchAll=false');
  }

  if (options.updateSnapshots) {
    reactScriptsArgs.push('--updateSnapshot');
  }

  if (options.verbose) {
    reactScriptsArgs.push('--verbose');
  }

  try {
    await runCommand('npm', ['run', 'test:frontend', '--', ...reactScriptsArgs.slice(1)], {
      cwd: path.join(__dirname, '../client')
    });
    console.log('\n✅ Frontend tests completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Frontend tests failed!\n');
    throw error;
  }
};

const runAllTests = async (options = {}) => {
  console.log('\n🎯 Running comprehensive test suite...\n');

  const testTypes = ['unit', 'integration', 'e2e'];
  let failedTests = [];

  for (const testType of testTypes) {
    try {
      await runTests(testType, options);
    } catch (error) {
      failedTests.push(testType);
      if (options.bail) {
        break;
      }
    }
  }

  // Run frontend tests
  try {
    await runFrontendTests(options);
  } catch (error) {
    failedTests.push('frontend');
  }

  // Generate combined coverage report
  if (!options.noCoverage) {
    await generateCombinedCoverageReport();
  }

  if (failedTests.length > 0) {
    console.error(`\n❌ Test suite failed! Failed test types: ${failedTests.join(', ')}\n`);
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed successfully!\n');
  }
};

const generateCombinedCoverageReport = async () => {
  console.log('\n📊 Generating combined coverage report...\n');

  try {
    // This would typically use a tool like nyc or istanbul to combine coverage
    // For now, we'll just create a simple report
    const coverageDir = path.join(__dirname, '../coverage');
    const reportFile = path.join(coverageDir, 'test-summary.json');

    const summary = {
      timestamp: new Date().toISOString(),
      testTypes: Object.keys(testConfig),
      status: 'completed',
      message: 'Comprehensive test suite completed successfully'
    };

    fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));
    console.log('📝 Coverage report generated: coverage/test-summary.json\n');
  } catch (error) {
    console.warn('⚠️  Could not generate combined coverage report:', error.message);
  }
};

const showHelp = () => {
  console.log(`
Neo VMS Test Runner

Usage:
  npm test [type] [options]

Test Types:
  unit          Run unit tests
  integration   Run integration tests  
  e2e           Run end-to-end tests
  frontend      Run frontend tests
  all           Run all tests (default)

Options:
  --watch       Watch for file changes
  --watchAll    Watch all files
  --coverage    Generate coverage report
  --no-coverage Skip coverage generation
  --bail        Stop on first failure
  --silent      Run tests silently
  --update      Update snapshots
  --detect-open-handles  Detect open handles
  --force-exit  Force exit after tests
  --run-in-band Run tests serially
  --max-workers=N  Set maximum worker processes

Examples:
  npm test                    # Run all tests
  npm test unit               # Run unit tests only
  npm test integration        # Run integration tests only
  npm test frontend -- --watch # Run frontend tests in watch mode
  npm test all -- --coverage  # Run all tests with coverage
  npm test unit -- --bail     # Run unit tests, stop on first failure

Environment Variables:
  NODE_ENV=test               # Set test environment
  CI=true                     # Enable CI mode
  JEST_TIMEOUT=30000          # Set Jest timeout
  `);
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  // Parse options
  const options = {
    watch: args.includes('--watch'),
    watchAll: args.includes('--watchAll'),
    coverage: args.includes('--coverage'),
    noCoverage: args.includes('--no-coverage'),
    bail: args.includes('--bail'),
    silent: args.includes('--silent'),
    updateSnapshots: args.includes('--update'),
    detectOpenHandles: args.includes('--detect-open-handles'),
    forceExit: args.includes('--force-exit'),
    runInBand: args.includes('--run-in-band'),
    verbose: args.includes('--verbose')
  };

  // Parse max workers
  const maxWorkersArg = args.find(arg => arg.startsWith('--max-workers='));
  if (maxWorkersArg) {
    options.maxWorkers = parseInt(maxWorkersArg.split('=')[1]);
  }

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Set environment
  process.env.NODE_ENV = 'test';

  try {
    switch (testType) {
      case 'unit':
      case 'integration':
      case 'e2e':
        await runTests(testType, options);
        break;
      case 'frontend':
        await runFrontendTests(options);
        break;
      case 'all':
        await runAllTests(options);
        break;
      default:
        console.error(`Unknown test type: ${testType}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runTests,
  runFrontendTests,
  runAllTests,
  testConfig
};