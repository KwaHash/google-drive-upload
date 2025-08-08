import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json(
        { error: "認証コードが提供されていません" },
        { status: 400 }
      );
    }

    const { tokens } = await auth.getToken(code);
    return NextResponse.json({ tokens }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "トークンの取得に失敗しました" },
      { status: 500 }
    );
  }
}
