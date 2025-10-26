/**
 * Mock logger for testing
 */

export function createMockLogger() {
  const mockFn = () => jest.fn();
  
  return {
    info: mockFn(),
    error: mockFn(),
    warn: mockFn(),
    debug: mockFn(),
    verbose: mockFn(),
    silly: mockFn()
  };
}