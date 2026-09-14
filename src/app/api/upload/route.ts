import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate mime type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file format. Please upload JPEG, PNG, or WebP images." },
        { status: 400 }
      );
    }

    // Validate size (max 8MB for serverless payload)
    const MAX_SIZE = 8 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image size exceeds 8MB limit. Please upload a smaller image." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Optional Cloudinary Upload if credentials exist
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      try {
        const uploadFormData = new FormData();
        const base64Data = `data:${file.type};base64,${buffer.toString("base64")}`;
        uploadFormData.append("file", base64Data);
        uploadFormData.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET || "atelier_uploads");

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            body: uploadFormData,
          }
        );

        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          if (cloudData.secure_url) {
            return NextResponse.json({
              success: true,
              url: cloudData.secure_url,
              filename: file.name,
              size: file.size,
              mimeType: file.type,
            });
          }
        }
      } catch (cloudErr) {
        console.warn("[Upload API] Cloudinary upload fallback to Data URI:", cloudErr);
      }
    }

    // Universal Serverless Storage: Return self-contained Data URI
    // Works 100% on Vercel Serverless, neon Postgres, without local disk writes
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
    });
  } catch (error: any) {
    console.error("[Upload API] Error processing upload:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process image upload" },
      { status: 500 }
    );
  }
}

