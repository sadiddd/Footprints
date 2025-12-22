import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({})
const ddbDocClient = DynamoDBDocumentClient.from(client)
const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const userId = event.queryStringParameters?.userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({message: "Missing UserID parameter"})
            }
        }

        const command = new QueryCommand({
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "UserID = :uid",
            ExpressionAttributeValues: {":uid": userId,},
        })

        const result = await ddbDocClient.send(command)
        const trips = result.Items || [];

        // Generate presigned URLs for the first image of each trip
        const tripsWithPresignedUrls = await Promise.all(
            trips.map(async (trip: any) => {
                if (trip.ImageUrls && trip.ImageUrls.length > 0) {
                    try {
                        // Extract key from first image URL
                        const firstImageUrl = trip.ImageUrls[0];
                        let key: string;
                        
                        // Check if imageUrl is already a key (doesn't start with http:// or https://)
                        if (!firstImageUrl.startsWith('http://') && !firstImageUrl.startsWith('https://')) {
                            // It's already a key, decode it in case it's URL-encoded
                            key = decodeURIComponent(firstImageUrl);
                        } else {
                            // It's a full URL, extract the key
                            try {
                                const urlObj = new URL(firstImageUrl);
                                // Remove leading slash from pathname and decode
                                key = decodeURIComponent(urlObj.pathname.substring(1));
                            } catch (urlErr) {
                                // If URL parsing fails, try to extract key from S3 URL format
                                // Handle both standard S3 URLs and presigned URLs
                                const match = firstImageUrl.match(/amazonaws\.com\/([^?]+)/);
                                if (match) {
                                    key = decodeURIComponent(match[1]);
                                } else {
                                    // Last resort: use as-is after decoding
                                    key = decodeURIComponent(firstImageUrl);
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
                        });

                        const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
                        
                        return {
                            ...trip,
                            ImageUrls: [presignedUrl, ...trip.ImageUrls.slice(1)] // Replace first URL with presigned
                        };
                    } catch (err) {
                        console.error("Error generating presigned URL:", err);
                        return trip; // Return original if error
                    }
                }
                return trip;
            })
        );

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tripsWithPresignedUrls),
        }
    } catch (err) {
        console.error("Error fetching trips:", err instanceof Error ? err.message : err)
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