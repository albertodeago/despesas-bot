export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('Get received');
  return Response.json({ message: 'Hello from the GET API' });
}

export async function POST(request: Request) {
  console.log('post received');
  return Response.json({ message: 'Hello from the POST API' });
}
