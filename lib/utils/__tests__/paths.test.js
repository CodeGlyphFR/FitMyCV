/**
 * Tests for path resolution utilities
 * Run with: npm test -- paths.test.js
 */

import path from "path";
import { resolveCvBaseDir, getUserCvPath, getUserRootPath } from "../paths";

describe("Path Resolution Utilities", () => {
  const originalEnv = process.env.CV_BASE_DIR;

  afterEach(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.CV_BASE_DIR = originalEnv;
    } else {
      delete process.env.CV_BASE_DIR;
    }
  });

  describe("resolveCvBaseDir", () => {
    test("should return absolute path unchanged", () => {
      process.env.CV_BASE_DIR = "/mnt/DATA/PROD/users";
      const result = resolveCvBaseDir();
      expect(result).toBe("/mnt/DATA/PROD/users");
    });

    test("should resolve relative path from cwd", () => {
      process.env.CV_BASE_DIR = "data/users";
      const result = resolveCvBaseDir();
      expect(result).toBe(path.join(process.cwd(), "data/users"));
    });

    test("should use default 'data/users' when env not set", () => {
      delete process.env.CV_BASE_DIR;
      const result = resolveCvBaseDir();
      expect(result).toBe(path.join(process.cwd(), "data/users"));
    });

    test("should handle absolute path on Windows", () => {
      process.env.CV_BASE_DIR = "C:\\Users\\Data\\cvs";
      const result = resolveCvBaseDir();
      expect(result).toBe("C:\\Users\\Data\\cvs");
    });

    test("should handle trailing slashes", () => {
      process.env.CV_BASE_DIR = "/mnt/data/users/";
      const result = resolveCvBaseDir();
      expect(result).toBe("/mnt/data/users/");
    });

    test("should allow override parameter", () => {
      process.env.CV_BASE_DIR = "data/users";
      const result = resolveCvBaseDir("/custom/path");
      expect(result).toBe("/custom/path");
    });
  });

  describe("getUserCvPath", () => {
    test("should throw error if userId is missing", () => {
      expect(() => getUserCvPath()).toThrow("userId is required");
      expect(() => getUserCvPath(null)).toThrow("userId is required");
      expect(() => getUserCvPath("")).toThrow("userId is required");
    });

    test("should return correct path with absolute CV_BASE_DIR", () => {
      process.env.CV_BASE_DIR = "/mnt/DATA/PROD/users";
      const result = getUserCvPath("user123");
      expect(result).toBe("/mnt/DATA/PROD/users/user123/cvs");
    });

    test("should return correct path with relative CV_BASE_DIR", () => {
      process.env.CV_BASE_DIR = "data/users";
      const result = getUserCvPath("user456");
      expect(result).toBe(path.join(process.cwd(), "data/users/user456/cvs"));
    });
  });

  describe("getUserRootPath", () => {
    test("should throw error if userId is missing", () => {
      expect(() => getUserRootPath()).toThrow("userId is required");
    });

    test("should return correct root path with absolute CV_BASE_DIR", () => {
      process.env.CV_BASE_DIR = "/mnt/DATA/users";
      const result = getUserRootPath("user789");
      expect(result).toBe("/mnt/DATA/users/user789");
    });

    test("should return correct root path with relative CV_BASE_DIR", () => {
      process.env.CV_BASE_DIR = "data/users";
      const result = getUserRootPath("user789");
      expect(result).toBe(path.join(process.cwd(), "data/users/user789"));
    });
  });
});
