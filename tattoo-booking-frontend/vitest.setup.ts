import "@testing-library/jest-dom";

// Suppress Next.js-specific console warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("Warning: ReactDOM.render") ||
      msg.includes("not wrapped in act")
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
