import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("accessToken");

    if (!accessToken) {
      return NextResponse.json(
        { error: "アクセストークンが提供されていません" },
        { status: 400 }
      );
    }

    auth.setCredentials({ access_token: accessToken });

    // Create Google Drive API client
    const drive = google.drive({ version: "v3", auth });

    // List shared drives
    const { data } = await drive.drives.list({
      pageSize: 100,
      fields: "drives(id, name, capabilities)",
    });

    const drives = data?.drives || [];
    return NextResponse.json({ drives }, { status: 200 });
  } catch (error) {
    console.error("Error listing shared drives: ", error);

    // Check if it's an authentication error
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラー";

    if (errorMessage.includes("Invalid Credentials")) {
      return NextResponse.json(
        { error: "アクセストークンが無効か期限切れです" },
        { status: 401 }
      );
    }

    // Return more detailed error information
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
