import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  try {
    const authUrl = auth.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
      ],
      prompt: "consent",
    });

    return NextResponse.json({ authUrl }, { status: 200 });
  } catch (error) {
    console.error("Error generating authorization URL:", error);
    return NextResponse.json(
      { error: "認証URLの生成に失敗しました" },
      { status: 500 }
    );
  }
}
