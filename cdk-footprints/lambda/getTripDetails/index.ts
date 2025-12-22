import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client)
const s3Client = new S3Client({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const userId = event.queryStringParameters?.userId
        const tripId = event.pathParameters?.id

        if (!userId || !tripId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({message: "Missing UserID or TripID parameter"})
            }
        }
        const command = new GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                UserID: userId,
                TripID: tripId
            }
        })

        const result = await ddbDocClient.send(command)

        if (!result.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({message: "Trip not found"})
            }
        }

        const trip = result.Item

        if (trip.ImageUrls && trip.ImageUrls.length > 0) {
            const presignedUrls = await Promise.all(
                trip.ImageUrls.map(async (imageUrl: string) => {
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

                        const getCommand = new GetObjectCommand({
                            Bucket: process.env.BUCKET_NAME,
                            Key: key,
                            ResponseCacheControl: 'max-age=3600',
                            ResponseContentType: getContentType(key),
                        })
                        return await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
                    } catch (err) {
                        console.error("Error generating presigned URL:", err)
                        return imageUrl
                    }
                })
            )
            trip.ImageUrls = presignedUrls
        }
    return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(trip),
        }
    } catch (err) {
        console.error("Error fetching trip details:", err instanceof Error ? err.message : err)
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({message: "Internal Server Error"})
        }
    }
}
