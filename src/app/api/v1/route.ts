import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '1',
    resources: ['boards', 'columns', 'cards', 'labels'],
    spec: '/openapi.json',
    auth: {
      type: 'bearer',
      format: 'lum_<hex>',
      header: 'Authorization: Bearer lum_your_key_here',
    },
    endpoints: {
      boards:  '/api/v1/boards',
      cards:   '/api/v1/cards/:id',
      columns: '/api/v1/boards/:id/columns',
      labels:  '/api/v1/boards/:id/labels',
    },
  });
}
