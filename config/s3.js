const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://t3.storageapi.dev",
  forcePathStyle: true, // required for Railway/Tigris
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }
});

module.exports = s3;