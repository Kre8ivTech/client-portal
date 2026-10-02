import { NextRequest, NextResponse } from "next/server";
import { dispatchPartnerApi } from "@/lib/partner-api/dispatch";
import { createPartnerRepository } from "@/lib/partner-api/repository";

async function handle(request: NextRequest, path: string[]) {
  let body: unknown = undefined;
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
  }

  try {
    const result = await dispatchPartnerApi(
      {
        method: request.method,
        path: `/${path.join("/")}`,
        authorization: request.headers.get("authorization"),
        body,
      },
      createPartnerRepository(),
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return handle(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return handle(request, path);
}
