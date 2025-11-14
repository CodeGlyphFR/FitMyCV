/**
 * Path resolution utilities for environment-configured directories
 *
 * This module centralizes path resolution logic for CV_BASE_DIR,
 * supporting both absolute and relative paths across platforms.
 */

import path from "path";

/**
 * Resolves the CV base directory, supporting both absolute and relative paths
 *
 * @param {string} [envDir] - Optional override for CV_BASE_DIR env variable
 * @returns {string} Absolute path to the CV base directory
 *
 * @example
 * // Relative path (default)
 * // CV_BASE_DIR="data/users" -> /home/user/project/data/users
 *
 * @example
 * // Absolute path (Linux/macOS)
 * // CV_BASE_DIR="/mnt/DATA/PROD/users" -> /mnt/DATA/PROD/users
 *
 * @example
 * // Absolute path (Windows)
 * // CV_BASE_DIR="C:\\Users\\Data\\cvs" -> C:\Users\Data\cvs
 */
export function resolveCvBaseDir(envDir) {
  const baseDir = envDir || process.env.CV_BASE_DIR || "data/users";

  // If path is absolute, use it as-is. Otherwise, resolve from cwd
  return path.isAbsolute(baseDir)
    ? baseDir
    : path.join(process.cwd(), baseDir);
}

/**
 * Gets the full path to a user's CV directory
 *
 * @param {string} userId - User ID
 * @returns {string} Absolute path to user's CV directory
 *
 * @throws {Error} If userId is not provided
 *
 * @example
 * getUserCvPath("user123")
 * // -> /home/user/project/data/users/user123/cvs
 *
 * @example
 * // With absolute CV_BASE_DIR="/mnt/DATA/users"
 * getUserCvPath("user456")
 * // -> /mnt/DATA/users/user456/cvs
 */
export function getUserCvPath(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const baseDir = resolveCvBaseDir();
  return path.join(baseDir, userId, "cvs");
}

/**
 * Gets the full path to a user's root directory
 *
 * @param {string} userId - User ID
 * @returns {string} Absolute path to user's root directory
 *
 * @throws {Error} If userId is not provided
 *
 * @example
 * getUserRootPath("user123")
 * // -> /home/user/project/data/users/user123
 *
 * @example
 * // With absolute CV_BASE_DIR="/mnt/DATA/users"
 * getUserRootPath("user456")
 * // -> /mnt/DATA/users/user456
 */
export function getUserRootPath(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const baseDir = resolveCvBaseDir();
  return path.join(baseDir, userId);
}
