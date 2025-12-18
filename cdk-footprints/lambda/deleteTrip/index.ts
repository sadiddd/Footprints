import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
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
        const { UserID, TripID } = data

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

        const command = new DeleteCommand({
            TableName: process.env.TABLE_NAME,
            Key: {
                UserID: UserID,
                TripID: TripID
            },
            ConditionExpression: "attribute_exists(TripID)"
        })

        await ddbDocClient.send(command)
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify("Trip deleted successfully")
        }
    } catch (err) {
        console.error("Error deleting trip:", err instanceof Error ? err.message : err)
        
        if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: "Trip not found" }),
            }
        }
        
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "Internal Server Error" }),
        }
    }
}