import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sharedDriveId = formData.get("sharedDriveId") as string;
    const parentId = formData.get("parentId") as string;
    const accessToken = formData.get("accessToken") as string;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが提供されていません" },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "アクセストークンが提供されていません" },
        { status: 400 }
      );
    }

    auth.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create file metadata with proper parent folder
    const fileMetadata = {
      name: file.name,
      parents: parentId ? [parentId] : [sharedDriveId],
    };

    // Upload the file using a different approach
    const response = await drive.files.create({
      requestBody: {
        ...fileMetadata,
      },
      media: {
        mimeType: file.type,
        body: Readable.from(buffer),
      },
      supportsAllDrives: true,
      supportsTeamDrives: true,
      fields: "id",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("ファイルのアップロードに失敗しました");
    }

    return NextResponse.json({
      fileId,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
