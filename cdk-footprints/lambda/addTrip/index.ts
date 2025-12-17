import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({})
const ddbDocClient = DynamoDBDocumentClient.from(client)

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({message: "Missing request body"})
            }
        }

        const data = JSON.parse(event.body)
        const { UserID, TripID, Title, Location, Description, ImageUrls, StartDate, EndDate, Visibility, CreatedAt } = data

        if (!UserID || !TripID) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({message: "UserID and TripID are required"})
            }
        }

        const command = new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                UserID,
                TripID,
                Title,
                Location,
                Description,
                ImageUrls: ImageUrls || [],
                StartDate: StartDate || null,
                EndDate: EndDate || null,
                Visibility: Visibility || "public",
                CreatedAt: CreatedAt || new Date().toISOString(),
            },
        })

        await ddbDocClient.send(command)

        return {
            statusCode: 201,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                message: "Trip added successfully", 
                trip: { UserID, TripID, Title, Location, Description, ImageUrls, StartDate, EndDate, Visibility, CreatedAt } 
            }),
        };
    } catch (err) {
        console.error("Error adding trip:", err instanceof Error ? err.message : err);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
}