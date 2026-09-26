export async function GET() {
  return Response.json({
    tripo: Boolean(process.env.TRIPO_API_KEY),
    meshy: Boolean(process.env.MESHY_API_KEY),
    generationEnabled: process.env.GENERATION_ENABLED === 'true',
  });
}
