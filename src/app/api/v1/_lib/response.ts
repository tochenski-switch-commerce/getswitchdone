import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status });
}

export function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status });
}
