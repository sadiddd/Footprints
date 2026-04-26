import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
    "Content-Type": "application/json",
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    try {
        const aiServiceUrl = process.env.AI_SERVICE_URL;

        if (!aiServiceUrl) {
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({message: "AI Service URL is not configured"})
            };
        }

        const userId = event.queryStringParameters?.userId || JSON.parse(event.body || '{}').userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({message: "Missing UserID"})
            }
        }

        const response = await fetch(`${aiServiceUrl}/recommend`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                userId,
                numSimilar: 3,
                numDifferent: 2,
             })
         });

         const data = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                headers: corsHeaders,
                body: JSON.stringify(data)
            };
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Failed to get recommendations:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({message: "Failed to get recommendations"})
        };
    }
}