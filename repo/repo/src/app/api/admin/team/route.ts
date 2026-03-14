import { NextResponse } from "next/server";
import { getTeam, createTeamMember } from "@/lib/admin-store";

export async function GET() {
  try {
    const team = await getTeam();
    return NextResponse.json(team);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const member = await createTeamMember(body);
    return NextResponse.json(member, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create team member" }, { status: 500 });
  }
}
