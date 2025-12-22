import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const s3Client = new S3Client({});

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
            }
        }

        const data = JSON.parse(event.body);
        const { userId, tripId, fileNames } = data;

        if (!userId || !tripId || !fileNames || !Array.isArray(fileNames)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "userId, tripId, and fileNames (array) are required" })
            }
        }

        // Generate presigned URLs for each file
        const uploadUrls = await Promise.all(
            fileNames.map(async (fileName: string) => {
                const key = `trips/${userId}/${tripId}/${fileName}`;
                
                const command = new PutObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: key,
                    ContentType: 'image/*'
                });

                const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

                return {
                    fileName,
                    uploadUrl: url,
                    imageUrl: key 
                };
            })
        );

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uploadUrls })
        };
    } catch (err) {
        console.error("Error generating presigned URLs:", err instanceof Error ? err.message : err);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};
