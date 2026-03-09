import { NextResponse } from 'next/server';

export async function GET() {
  const association = {
    applinks: {
      apps: [],
      details: [
        {
          appID: '2ZKQAMR7G5.com.getswitchdone.boards',
          paths: ['/boards/*'],
        },
      ],
    },
  };

  return NextResponse.json(association, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
