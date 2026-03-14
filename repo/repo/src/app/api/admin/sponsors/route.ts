import { NextResponse } from "next/server";
import { getSponsors, createSponsor } from "@/lib/admin-store";

export async function GET() {
  try {
    const sponsors = await getSponsors();
    return NextResponse.json(sponsors);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sponsor = await createSponsor(body);
    return NextResponse.json(sponsor, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create sponsor" }, { status: 500 });
  }
}
