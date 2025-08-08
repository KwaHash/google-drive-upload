import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const { name, parentId, sharedDriveId, accessToken } = await request.json();

    if (!name || !accessToken) {
      return NextResponse.json(
        { error: "必要なパラメータが不足しています" },
        { status: 400 }
      );
    }

    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth });

    const folderMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    };

    const requestBody = sharedDriveId
      ? { ...folderMetadata, driveId: sharedDriveId }
      : folderMetadata;

    const response = await drive.files.create({
      requestBody,
      supportsAllDrives: true,
      supportsTeamDrives: true,
      fields: "id",
    });

    const folderId = response.data.id;
    if (!folderId) {
      throw new Error("フォルダの作成に失敗しました");
    }

    return NextResponse.json({ folderId }, { status: 200 });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "フォルダの作成に失敗しました" },
      { status: 500 }
    );
  }
}
