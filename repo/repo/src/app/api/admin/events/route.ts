import { NextRequest, NextResponse } from "next/server";
import { getEvents, createEvent } from "@/lib/admin-store";

export async function GET() {
  const events = await getEvents();
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = await createEvent(body);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 400 }
    );
  }
}
