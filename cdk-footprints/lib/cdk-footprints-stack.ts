import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

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

    // S3 Bucket for Photos
    const photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }]
    })

    // Lambda Function for addTrip
    const addTripLambda = new NodejsFunction(this, 'addTripLambda', {
      entry: 'lambda/addTrip/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
      }
    })

    // Lambda Function for getTrip
    const getTripsLambda = new NodejsFunction(this, 'getTripsLambda', {
      entry: 'lambda/getTrips/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        BUCKET_NAME: photosBucket.bucketName,
      }
    })

    // Lambda Function for getTripDetails
    const getTripDetailsLambda = new NodejsFunction(this, 'getTripDetailsLambda', {
      entry: 'lambda/getTripDetails/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        BUCKET_NAME: photosBucket.bucketName,
      }
    })

    // Lambda Function for getUploadUrls
    const getUploadUrlsLambda = new NodejsFunction(this, 'getUploadUrlsLambda', {
      entry: 'lambda/getUploadUrls/index.ts',
      handler: 'handler',
      environment: {
        BUCKET_NAME: photosBucket.bucketName,
      }
    })

    // Lambda Function for getImageUrls
    const getImageUrlsLambda = new NodejsFunction(this, 'getImageUrlsLambda', {
      entry: 'lambda/getImageUrls/index.ts',
      handler: 'handler',
      environment: {
        BUCKET_NAME: photosBucket.bucketName,
      }
    })

    // Lambda Function for updateTrip
    const updateTripLambda = new NodejsFunction(this, 'updateTripLambda', {
      entry: 'lambda/updateTrip/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
      }
    })

    // Lambda Function for deleteTrip
    const deleteTripLambda = new NodejsFunction(this, "deleteTripLambda", {
      entry: "lambda/deleteTrip/index.ts",
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
      }
    })

    // Grant permissions for DynamoDB
    tripsTable.grantWriteData(addTripLambda)
    tripsTable.grantReadData(getTripsLambda)
    tripsTable.grantReadData(getTripDetailsLambda)
    tripsTable.grantReadWriteData(updateTripLambda)
    tripsTable.grantReadWriteData(deleteTripLambda)

    // Grant permissions for S3
    photosBucket.grantRead(addTripLambda)
    photosBucket.grantRead(getTripsLambda)
    photosBucket.grantRead(getTripDetailsLambda)
    photosBucket.grantRead(getImageUrlsLambda)
    photosBucket.grantPut(getUploadUrlsLambda)
    photosBucket.grantDelete(deleteTripLambda)

    // API Gateway
    const api = new apigateway.RestApi(this, 'FootprintsApi', {
      restApiName: "Footprints Service",
      description: "API for travel journal app",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      }
    })

    // Resources
    const trips = api.root.addResource('Trips')
    trips.addMethod('POST', new apigateway.LambdaIntegration(addTripLambda))
    trips.addMethod('GET', new apigateway.LambdaIntegration(getTripsLambda))
    trips.addMethod('PUT', new apigateway.LambdaIntegration(updateTripLambda))
    trips.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTripLambda))
    
    // Sub-resource for individual trip details
    const tripDetails = trips.addResource('{id}')
    tripDetails.addMethod('GET', new apigateway.LambdaIntegration(getTripDetailsLambda))

    // Upload URLs endpoint
    const upload = api.root.addResource('upload')
    upload.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlsLambda))

    // Image URLs endpoint
    const imageUrls = api.root.addResource('image-urls')
    imageUrls.addMethod('POST', new apigateway.LambdaIntegration(getImageUrlsLambda))
  }
}
