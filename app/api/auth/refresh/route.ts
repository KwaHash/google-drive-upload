import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return NextResponse.json(
        { error: "リフレッシュトークンが提供されていません" },
        { status: 400 }
      );
    }

    auth.setCredentials({ refresh_token });
    const { credentials } = await auth.refreshAccessToken();

    return NextResponse.json({ tokens: credentials }, { status: 200 });
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return NextResponse.json(
      { error: "アクセストークンの更新に失敗しました" },
      { status: 500 }
    );
  }
}
