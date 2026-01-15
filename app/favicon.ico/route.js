// Route vide pour éviter le 404 favicon
export function GET() {
  return new Response(null, { status: 204 });
}
