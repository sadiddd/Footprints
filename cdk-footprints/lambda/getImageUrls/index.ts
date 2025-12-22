import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "Missing request body" })
            };
        }

        const { imageUrls } = JSON.parse(event.body);

        if (!imageUrls || !Array.isArray(imageUrls)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "imageUrls array is required" })
            };
        }

        // Generate presigned URLs for each image
        const presignedUrls = await Promise.all(
            imageUrls.map(async (imageUrl: string) => {
                try {
                    let key: string;
                    
                    // Check if imageUrl is already a key (doesn't start with http:// or https://)
                    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                        // It's already a key, decode it in case it's URL-encoded
                        key = decodeURIComponent(imageUrl);
                    } else {
                        // It's a full URL, extract the key
                        try {
                            const urlObj = new URL(imageUrl);
                            // Remove leading slash from pathname and decode
                            key = decodeURIComponent(urlObj.pathname.substring(1));
                        } catch (urlErr) {
                            // If URL parsing fails, try to extract key from S3 URL format
                            // Handle both standard S3 URLs and presigned URLs
                            const match = imageUrl.match(/amazonaws\.com\/([^?]+)/);
                            if (match) {
                                key = decodeURIComponent(match[1]);
                            } else {
                                // Last resort: use as-is after decoding
                                key = decodeURIComponent(imageUrl);
                            }
                        }
                    }

                    // Detect content type from file extension
                    const getContentType = (key: string): string => {
                        const ext = key.toLowerCase().split('.').pop();
                        const contentTypes: Record<string, string> = {
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'png': 'image/png',
                            'gif': 'image/gif',
                            'webp': 'image/webp',
                            'svg': 'image/svg+xml',
                            'heic': 'image/heic',
                            'heif': 'image/heif',
                        };
                        return contentTypes[ext || ''] || 'image/jpeg'; // Default to JPEG if unknown
                    };

                    const command = new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: key,
                        ResponseCacheControl: 'max-age=3600',
                        ResponseContentType: getContentType(key),
                    });

                    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

                    return {
                        originalUrl: imageUrl,
                        presignedUrl
                    };
                } catch (err) {
                    console.error(`Error generating presigned URL for ${imageUrl}:`, err);
                    return {
                        originalUrl: imageUrl,
                        presignedUrl: null,
                        error: err instanceof Error ? err.message : 'Unknown error'
                    };
                }
            })
        );

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ imageUrls: presignedUrls }),
        };
    } catch (err) {
        console.error("Error generating presigned URLs:", err instanceof Error ? err.message : err);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};
