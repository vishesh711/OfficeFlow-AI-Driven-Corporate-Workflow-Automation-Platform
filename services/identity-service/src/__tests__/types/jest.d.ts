/**
 * Jest global types for test files
 */

declare global {
  const jest: {
    fn: () => jest.MockedFunction<any>;
  };
}

export {};