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
                    // Extract the S3 key from the URL
                    const key = imageUrl.split('.com/')[1] || imageUrl;

                    const command = new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: key,
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
