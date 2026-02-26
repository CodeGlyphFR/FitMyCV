/**
 * Health check endpoint for deployment scripts
 * GET /api/health
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
