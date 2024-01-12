import * as cdk from 'aws-cdk-lib';
import { RestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path from 'path';

export class DespesasBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambda = new NodejsFunction(this, 'despesas-bot-lambda-handler', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, `../main.js`),
      handler: 'handler',
      functionName: 'despesas-bot-lambda',
      environment: {
        TELEGRAM_SECRET: process.env.TELEGRAM_SECRET!,
      },
    });

    const api = new RestApi(this, 'despesas-bot-api', {
      restApiName: 'DespsesasBot-API',
      deployOptions: { stageName: 'prod' },
    });

    api.root
      .addResource('despesas-bot')
      .addMethod('POST', new LambdaIntegration(lambda, { proxy: true }));

    // These would be useful if we could set the webhook in the Github action, but we need to do it in the code for now
    // new cdk.CfnOutput(this, 'apiHostname', { value: `${api.restApiId}.execute-api.localhost.localstack.cloud` });
    // new cdk.CfnOutput(this, 'apiUrl', { value: `${api.url}despesas-bot` });
  }
}
