#!/usr/bin/env node
import { DespesasBotStack } from './despesas-bot-stack';
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';

const app = new cdk.App();
new DespesasBotStack(app, 'DespesasBotStack', {});
