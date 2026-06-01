import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
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

    // VPC for EC2 and Lambdas
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Security Group for AI service
    const aiSG = new ec2.SecurityGroup(this, 'AISecurityGroup', {
      vpc,
      description: 'Security group for AI service',
      allowAllOutbound: true,
    });

    // Security Group for Lambdas that call the AI service
    const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambdas',
      allowAllOutbound: true,
    });

    // Allow only lambdaSG to reach the AI service on port 8000
    aiSG.addIngressRule(
      lambdaSG,
      ec2.Port.tcp(8000),
      'Allow Lambda to call AI service'
    )

    // Allowing traffic from port 22 (SSH)
    aiSG.addIngressRule(
      aiSG,
      ec2.Port.tcp(22),
      'Allow SSH traffic from EC2 Instance Connect Endpoint'
    );

    // Bootstrap script: clones repo, installs deps, creates systemd service.
    // After deploy, SSH in and run ONE command to set the OpenAI key:
    //   echo "OPENAI_API_KEY=sk-..." | sudo tee /etc/ai-service.env && sudo chmod 600 /etc/ai-service.env && sudo systemctl start ai-service
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf install -y python3-pip git',

      'sudo -u ec2-user git clone https://github.com/sadiddd/Footprints.git /home/ec2-user/Footprints',
      'pip3 install -r /home/ec2-user/Footprints/ai-service/requirements.txt',

      // Empty env file — user fills this in after deploy
      'touch /etc/ai-service.env',
      'chmod 600 /etc/ai-service.env',

      // Systemd unit — written line by line to avoid heredoc issues
      'echo "[Unit]" > /etc/systemd/system/ai-service.service',
      'echo "Description=Footprints AI Service" >> /etc/systemd/system/ai-service.service',
      'echo "After=network.target" >> /etc/systemd/system/ai-service.service',
      'echo "" >> /etc/systemd/system/ai-service.service',
      'echo "[Service]" >> /etc/systemd/system/ai-service.service',
      'echo "User=ec2-user" >> /etc/systemd/system/ai-service.service',
      'echo "WorkingDirectory=/home/ec2-user/Footprints/ai-service" >> /etc/systemd/system/ai-service.service',
      'echo "EnvironmentFile=/etc/ai-service.env" >> /etc/systemd/system/ai-service.service',
      'echo "ExecStart=/usr/local/bin/uvicorn main:app --host 0.0.0.0 --port 8000" >> /etc/systemd/system/ai-service.service',
      'echo "Restart=always" >> /etc/systemd/system/ai-service.service',
      'echo "RestartSec=5" >> /etc/systemd/system/ai-service.service',
      'echo "" >> /etc/systemd/system/ai-service.service',
      'echo "[Install]" >> /etc/systemd/system/ai-service.service',
      'echo "WantedBy=multi-user.target" >> /etc/systemd/system/ai-service.service',

      'systemctl daemon-reload',
      'systemctl enable ai-service',
      // Service starts automatically once the key is populated via the post-deploy step
    );

    // EC2 Instance for AI service
    const aiInstance = new ec2.Instance(this, 'AIServiceInstance', {
      vpc,
      instanceType:ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.LARGE, // 8GB RAM
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: aiSG,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(30, {
          encrypted: true,
        }),
      }],
      userData,
    })

    // Instance Connect Endpoint for EC2
    const ec2ConnectEndpoint = new ec2.CfnInstanceConnectEndpoint(this, 'Ec2ConnectEndpoint', {
        subnetId: vpc.privateSubnets[0].subnetId,
        securityGroupIds: [aiSG.securityGroupId],
      }
    );

    const privateZone = new route53.PrivateHostedZone(this, 'FootprintsPrivateZone', {
      zoneName: "footprints.internal",
      vpc,
    });

    new route53.ARecord(this, 'AIServiceDNSRecord', {
      zone: privateZone,
      recordName: 'ai',
      target: route53.RecordTarget.fromIpAddresses(aiInstance.instancePrivateIp),
    })

    // Lambda Function for addTrip
    const addTripLambda = new NodejsFunction(this, 'addTripLambda', {
      entry: 'lambda/addTrip/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        AI_SERVICE_URL: "http://ai.footprints.internal:8000",
      },
      vpc,
      securityGroups: [lambdaSG],
    })

    // Lambda Function for getTrip
    const getTripsLambda = new NodejsFunction(this, 'getTripsLambda', {
      entry: 'lambda/getTrips/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        BUCKET_NAME: photosBucket.bucketName,
      },
      vpc,
    })

    // Lambda Function for getTripDetails
    const getTripDetailsLambda = new NodejsFunction(this, 'getTripDetailsLambda', {
      entry: 'lambda/getTripDetails/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        BUCKET_NAME: photosBucket.bucketName,
      },
      vpc,
    })

    // Lambda Function for getPublicTrips
    const getPublicTripsLambda = new NodejsFunction(this, 'getPublicTripsLambda', {
      entry: 'lambda/getPublicTrips/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        BUCKET_NAME: photosBucket.bucketName,
      },
      vpc,
    })

    // Lambda Function for getUploadUrls
    const getUploadUrlsLambda = new NodejsFunction(this, 'getUploadUrlsLambda', {
      entry: 'lambda/getUploadUrls/index.ts',
      handler: 'handler',
      environment: {
        BUCKET_NAME: photosBucket.bucketName,
      },
      vpc,
    })

    // Lambda Function for getImageUrls
    const getImageUrlsLambda = new NodejsFunction(this, 'getImageUrlsLambda', {
      entry: 'lambda/getImageUrls/index.ts',
      handler: 'handler',
      environment: {
        BUCKET_NAME: photosBucket.bucketName,
      },
      vpc,
    })

    // Lambda Function for updateTrip
    const updateTripLambda = new NodejsFunction(this, 'updateTripLambda', {
      entry: 'lambda/updateTrip/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
      },
      vpc,
    })

    // Lambda Function for deleteTrip
    const deleteTripLambda = new NodejsFunction(this, "deleteTripLambda", {
      entry: "lambda/deleteTrip/index.ts",
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
      },
      vpc,
    })

    // Lambda Function for getRecommendations
    const getRecommendationsLambda = new NodejsFunction(this, 'getRecommendationsLambda', {
      entry: 'lambda/getRecommendations/index.ts',
      handler: 'handler',
      environment: {
        AI_SERVICE_URL: "http://ai.footprints.internal:8000",
      },
      vpc,
      securityGroups: [lambdaSG],
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    })

    // Lambda Function for backfilling embeddings after EC2 replacement
    const backfillEmbeddingsLambda = new NodejsFunction(this, 'backfillEmbeddingsLambda', {
      entry: 'lambda/backfillEmbeddings/index.ts',
      handler: 'handler',
      environment: {
        TABLE_NAME: tripsTable.tableName,
        AI_SERVICE_URL: "http://ai.footprints.internal:8000",
      },
      vpc,
      securityGroups: [lambdaSG],
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
    })


    // Grant permissions for DynamoDB
    tripsTable.grantWriteData(addTripLambda)
    tripsTable.grantReadData(getTripsLambda)
    tripsTable.grantReadData(getTripDetailsLambda)
    tripsTable.grantReadData(getPublicTripsLambda)
    tripsTable.grantReadWriteData(updateTripLambda)
    tripsTable.grantReadWriteData(deleteTripLambda)
    tripsTable.grantReadData(backfillEmbeddingsLambda)

    // Grant permissions for S3
    photosBucket.grantRead(addTripLambda)
    photosBucket.grantRead(getTripsLambda)
    photosBucket.grantRead(getTripDetailsLambda)
    photosBucket.grantRead(getPublicTripsLambda)
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
        allowHeaders: ['*'],
      }
    })

    // Ensure CORS headers are present even when API Gateway returns an error
    // before the Lambda can respond (e.g. Lambda timeout/crash producing a 502).
    api.addGatewayResponse('Default5xx', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
    });
    api.addGatewayResponse('Default4xx', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
    });

    // Resources for trips
    const trips = api.root.addResource('Trips')
    trips.addMethod('POST', new apigateway.LambdaIntegration(addTripLambda))
    trips.addMethod('GET', new apigateway.LambdaIntegration(getTripsLambda))
    trips.addMethod('PUT', new apigateway.LambdaIntegration(updateTripLambda))
    trips.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTripLambda))
    
    // Resources for recommendations
    const recommendations = api.root.addResource('recommendations')
    recommendations.addMethod('POST', new apigateway.LambdaIntegration(getRecommendationsLambda))

    // Sub-resource for individual trip details
    const tripDetails = trips.addResource('{id}')
    tripDetails.addMethod('GET', new apigateway.LambdaIntegration(getTripDetailsLambda))

    // Upload URLs endpoint
    const upload = api.root.addResource('upload')
    upload.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlsLambda))

    // Image URLs endpoint
    const imageUrls = api.root.addResource('image-urls')
    imageUrls.addMethod('POST', new apigateway.LambdaIntegration(getImageUrlsLambda))

    // Public trips endpoint for browse page
    const publicTrips = api.root.addResource('public-trips')
    publicTrips.addMethod('GET', new apigateway.LambdaIntegration(getPublicTripsLambda))
  }
}
