import { NextResponse, type NextRequest } from "next/server";
import { getRepo } from "@/lib/store";
import { runReminderScan } from "@/lib/validation";
import { deliverQueuedMessages } from "@/lib/delivery";

export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  const direct = request.headers.get("x-cron-secret");
  return header === `Bearer ${secret}` || direct === secret;
}

async function handle(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const repo = getRepo();
  const scan = runReminderScan(repo);
  const delivery = await deliverQueuedMessages(repo);
  return NextResponse.json({ ...scan, delivery }, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
