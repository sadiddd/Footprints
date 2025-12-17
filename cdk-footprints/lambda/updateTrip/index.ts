import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

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

        const data = JSON.parse(event.body);
        const { UserID, TripID, Visibility } = data;

        if (!UserID || !TripID) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "UserID and TripID are required" })
            };
        }

        if (!Visibility || !['public', 'private'].includes(Visibility)) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "Visibility must be 'public' or 'private'" })
            };
        }

        // First, verify the trip exists
        const getCommand = new GetCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                UserID,
                TripID
            }
        });

        const getResult = await ddbDocClient.send(getCommand);

        if (!getResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: "Trip not found" })
            };
        }

        // Update the trip visibility
        const updateCommand = new UpdateCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                UserID,
                TripID
            },
            UpdateExpression: "SET Visibility = :visibility",
            ExpressionAttributeValues: {
                ":visibility": Visibility
            },
            ReturnValues: "ALL_NEW"
        });

        const result = await ddbDocClient.send(updateCommand);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: "Trip visibility updated successfully",
                trip: result.Attributes
            }),
        };
    } catch (err) {
        console.error("Error updating trip:", err instanceof Error ? err.message : err);
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
