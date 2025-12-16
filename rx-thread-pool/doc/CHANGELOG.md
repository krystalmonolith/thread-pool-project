# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-12

### Added
- Initial release of Node.js Multi-Threading Framework
- `AbstractThreadTask` - Generic abstract container class for thread callback functions
- `ThreadTask` - Concrete implementation of AbstractThreadTask
- `ThreadQueue` - FIFO queue for managing thread tasks
- `ThreadPool` - Worker thread pool manager with automatic parallelism detection
- Full TypeScript support with comprehensive type definitions
- RxJS v7 Observable integration for reactive programming
- Worker thread execution with message passing
- Unique thread ID assignment for each worker
- Merged observable results from all threads
- Support for multiple task queues
- Automatic thread count based on `os.availableParallelism()`
- Complete documentation and examples
- Support for CPU-intensive parallel computations
- Error handling and worker lifecycle management

### Features
- Execute tasks in parallel using Node.js Worker Threads
- Type-safe generic interfaces
- Observable-based asynchronous result handling
- FIFO queue ordering for task execution
- Multiple queue support for task organization
- Automatic serialization of thread functions
- Clean API for thread pool management

### Documentation
- Comprehensive README with usage examples
- API documentation for all classes and methods
- Advanced examples demonstrating various use cases
- Best practices and limitations guidance
