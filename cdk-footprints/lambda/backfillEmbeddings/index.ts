import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
    const tableName = process.env.TABLE_NAME;
    const aiServiceUrl = process.env.AI_SERVICE_URL;

    if (!tableName || !aiServiceUrl) {
        return { statusCode: 500, body: JSON.stringify({ message: "Missing TABLE_NAME or AI_SERVICE_URL" }) };
    }

    const trips: Record<string, unknown>[] = [];
    let lastKey: Record<string, unknown> | undefined;

    // Paginate through entire trips table
    do {
        const result = await ddb.send(new ScanCommand({
            TableName: tableName,
            ExclusiveStartKey: lastKey,
        }));
        trips.push(...(result.Items ?? []));
        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastKey);

    let succeeded = 0;
    let failed = 0;

    for (const trip of trips) {
        try {
            const response = await fetch(`${aiServiceUrl}/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tripId: trip.TripID,
                    userId: trip.UserID,
                    title: trip.Title ?? "",
                    location: trip.Location ?? "",
                    description: trip.Description ?? "",
                    photoTags: [],
                }),
            });

            if (response.ok) {
                succeeded++;
            } else {
                console.error(`Failed to embed trip ${trip.TripID}: HTTP ${response.status}`);
                failed++;
            }
        } catch (err) {
            console.error(`Error embedding trip ${trip.TripID}:`, err);
            failed++;
        }
    }

    const summary = { total: trips.length, succeeded, failed };
    console.log("Backfill complete:", summary);
    return { statusCode: 200, body: JSON.stringify(summary) };
};
