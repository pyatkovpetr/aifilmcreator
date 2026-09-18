import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { formatVideoDirectorInputError, generateVideoDirectorIdeas, parseVideoDirectorInput } from "@/lib/ai-video-director";
import { saveDraft } from "@/lib/store";
import { userId } from "@/lib/standalone-director-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const input = parseVideoDirectorInput(await req.json());
    const payload = await generateVideoDirectorIdeas(input);
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    await saveDraft({ id: sessionId, type: "ideas", input, analysis: payload.analysis, ideas: payload.ideas, userId: userId(req), createdAt: now, updatedAt: now });
    return NextResponse.json({ sessionId, ...payload });
  } catch (error) {
    return NextResponse.json({ error: formatVideoDirectorInputError(error) }, { status: 400 });
  }
}
