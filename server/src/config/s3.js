import { S3Client } from "@aws-sdk/client-s3";

let _s3Client;

export function isS3Configured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.S3_BUCKET_NAME
  );
}

export function getS3BucketName() {
  return process.env.S3_BUCKET_NAME;
}

/**
 * Lazily create S3 client so `.env` loaded in src/index.js is respected in ESM.
 */
export function getS3Client() {
  if (_s3Client) return _s3Client;

  if (!isS3Configured()) {
    throw new Error("S3 is not configured. Missing AWS_* env vars or S3_BUCKET_NAME.");
  }

  _s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return _s3Client;
}
