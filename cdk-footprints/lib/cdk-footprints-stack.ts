import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class CdkFootprintsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const tripsTable = new dynamodb.Table(this, 'tripsTable', {
      partitionKey: { name : 'UserID', type: dynamodb.AttributeType.STRING},
      sortKey: {name : 'TripID', type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Lambda Function for addTrip
    const addTripLambda = new lambda.Function(this, 'addTripLambda', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/addTrip'),
      environment: {
        TABLE_NAME: tripsTable.tableName,
      }
    })

    // Lambda Function for getTrip
    const getTripsLambda = new lambda.Function(this, 'getTripsLambda', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/getTrip'),
      environment: {
        TABLE_NAME: tripsTable.tableName,
      }
    })

    // Grant permissions for getTrips and addTrip
    tripsTable.grantWriteData(addTripLambda)
    tripsTable.grantReadData(getTripsLambda)

    // API Gateway
    const api = new apigateway.RestApi(this, 'FootprintsApi', {
      restApiName: "Footprints Service",
      description: "API for travel journal app"
    })

    // Resources
    const trips = api.root.addResource('Trips')
    trips.addMethod('POST', new apigateway.LambdaIntegration(addTripLambda))
    trips.addMethod('GET', new apigateway.LambdaIntegration(getTripsLambda))
  }
}
