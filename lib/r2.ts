import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
const bucketName = process.env.R2_BUCKET_NAME!;

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Upload a file buffer to R2
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ error: string | null }> {
  try {
    await r2.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return { error: null };
  } catch (err) {
    console.error("R2 upload error:", err);
    return { error: "Upload failed" };
  }
}

// Delete a file from R2
export async function deleteFile(key: string): Promise<{ error: string | null }> {
  try {
    await r2.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
    return { error: null };
  } catch (err) {
    console.error("R2 delete error:", err);
    return { error: "Delete failed" };
  }
}

// Generate a pre-signed URL for temporary direct download (expires in 1 hour)
export async function getDownloadUrl(key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return await getSignedUrl(r2, command, { expiresIn: 3600 });
  } catch (err) {
    console.error("R2 presign error:", err);
    return null;
  }
}

// Build a consistent R2 key from parts
// e.g. buildKey("compliance", 1, "renewal.pdf") → "bizcore/compliance/1/renewal.pdf"
export function buildKey(category: string, linkedId: number, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `bizcore/${category}/${linkedId}/${sanitized}`;
}
