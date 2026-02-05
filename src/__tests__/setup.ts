import { beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db';
process.env.UPLOAD_DIR = './test-uploads';

beforeAll(() => {
  // Setup before all tests
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Final cleanup
});
