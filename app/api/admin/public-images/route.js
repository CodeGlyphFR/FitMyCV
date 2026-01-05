import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import fs from 'fs';
import path from 'path';

// Image extensions to look for
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];

/**
 * Recursively get all image files from a directory
 */
function getImagesFromDir(dirPath, basePath = '', results = []) {
  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules, .git, and other common non-image directories
          if (!['node_modules', '.git', '.next', 'api'].includes(item)) {
            getImagesFromDir(fullPath, relativePath, results);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (IMAGE_EXTENSIONS.includes(ext)) {
            results.push({
              name: item,
              path: '/' + relativePath.replace(/\\/g, '/'), // URL path
              folder: basePath || '/',
              size: stat.size,
              extension: ext,
            });
          }
        }
      } catch (err) {
        // Skip files we can't access
        console.warn(`[Public Images API] Cannot access ${fullPath}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`[Public Images API] Error reading directory ${dirPath}:`, err);
  }

  return results;
}

/**
 * GET /api/admin/public-images
 * List all images in the public folder
 */
export async function GET(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder'); // Optional: filter by folder

    // Get the public directory path
    const publicDir = path.join(process.cwd(), 'public');

    if (!fs.existsSync(publicDir)) {
      return NextResponse.json({ images: [], folders: [] });
    }

    // Get all images
    let images = getImagesFromDir(publicDir);

    // Filter by folder if specified
    if (folder) {
      images = images.filter((img) => img.folder.startsWith(folder));
    }

    // Sort by folder, then by name
    images.sort((a, b) => {
      if (a.folder !== b.folder) {
        return a.folder.localeCompare(b.folder);
      }
      return a.name.localeCompare(b.name);
    });

    // Get unique folders for filtering
    const folders = [...new Set(images.map((img) => img.folder))].sort();

    return NextResponse.json({
      images,
      folders,
      total: images.length,
    });
  } catch (error) {
    console.error('[Public Images API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list images' },
      { status: 500 }
    );
  }
}
