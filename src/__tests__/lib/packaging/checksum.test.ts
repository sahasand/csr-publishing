/**
 * Checksum Calculation Tests
 *
 * Tests for MD5 checksum calculation utilities.
 * Only tests the buffer-based function since file-based functions
 * require actual file system access.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMd5FromBuffer,
} from '@/lib/packaging/checksum';

describe('Checksum Calculation', () => {
  describe('calculateMd5FromBuffer', () => {
    it('should calculate MD5 for empty buffer', () => {
      const buffer = Buffer.from('');
      const checksum = calculateMd5FromBuffer(buffer);

      // MD5 of empty string is d41d8cd98f00b204e9800998ecf8427e
      expect(checksum).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    it('should calculate MD5 for text content', () => {
      const buffer = Buffer.from('Hello, World!');
      const checksum = calculateMd5FromBuffer(buffer);

      // MD5 of "Hello, World!" is 65a8e27d8879283831b664bd8b7f0ad4
      expect(checksum).toBe('65a8e27d8879283831b664bd8b7f0ad4');
    });

    it('should return lowercase hex string', () => {
      const buffer = Buffer.from('test');
      const checksum = calculateMd5FromBuffer(buffer);

      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should be consistent for same input', () => {
      const buffer = Buffer.from('consistent test data');
      const checksum1 = calculateMd5FromBuffer(buffer);
      const checksum2 = calculateMd5FromBuffer(buffer);

      expect(checksum1).toBe(checksum2);
    });

    it('should produce different checksums for different content', () => {
      const buffer1 = Buffer.from('content A');
      const buffer2 = Buffer.from('content B');

      const checksum1 = calculateMd5FromBuffer(buffer1);
      const checksum2 = calculateMd5FromBuffer(buffer2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should handle binary data', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      const checksum = calculateMd5FromBuffer(buffer);

      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should handle large buffers', () => {
      // Create a 1MB buffer
      const buffer = Buffer.alloc(1024 * 1024, 'x');
      const checksum = calculateMd5FromBuffer(buffer);

      expect(checksum).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Known MD5 Values', () => {
    // Test against known MD5 hashes
    const testCases = [
      { input: '', expected: 'd41d8cd98f00b204e9800998ecf8427e' },
      { input: 'a', expected: '0cc175b9c0f1b6a831c399e269772661' },
      { input: 'abc', expected: '900150983cd24fb0d6963f7d28e17f72' },
      { input: 'message digest', expected: 'f96b697d7cb7938d525a2f31aaf161d0' },
      { input: 'abcdefghijklmnopqrstuvwxyz', expected: 'c3fcd3d76192e4007dfb496cca67e13b' },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should produce correct hash for "${input.substring(0, 20)}${input.length > 20 ? '...' : ''}"`, () => {
        const buffer = Buffer.from(input);
        const checksum = calculateMd5FromBuffer(buffer);

        expect(checksum).toBe(expected);
      });
    });
  });
});
