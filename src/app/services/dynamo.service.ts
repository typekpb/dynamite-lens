import { Injectable } from '@angular/core';
import {
  AttributeDefinition,
  BillingMode,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  KeySchemaElement,
  ListTablesCommand,
  TableDescription,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  ExecuteStatementCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConnectionService } from './connection.service';

export interface PageResult {
  items: Record<string, any>[];
  lastEvaluatedKey?: Record<string, any>;
  scannedCount?: number;
  count?: number;
}

export interface QueryOptions {
  indexName?: string;
  keyConditionExpression: string;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
  scanIndexForward?: boolean;
}

export interface ScanOptions {
  indexName?: string;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, any>;
  expressionAttributeNames?: Record<string, string>;
  projectionExpression?: string;
  limit?: number;
  exclusiveStartKey?: Record<string, any>;
}

export interface CreateTableSpec {
  tableName: string;
  billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
  readCapacity?: number;
  writeCapacity?: number;
  attributes: AttributeDefinition[];
  keySchema: KeySchemaElement[];
}

@Injectable({ providedIn: 'root' })
export class DynamoService {
  constructor(private conn: ConnectionService) {}

  async listTables(): Promise<string[]> {
    const client = this.conn.getClient();
    const names: string[] = [];
    let exclusiveStartTableName: string | undefined;
    do {
      const out = await client.send(
        new ListTablesCommand({ ExclusiveStartTableName: exclusiveStartTableName }),
      );
      names.push(...(out.TableNames ?? []));
      exclusiveStartTableName = out.LastEvaluatedTableName;
    } while (exclusiveStartTableName);
    return names;
  }

  async describeTable(tableName: string): Promise<TableDescription> {
    const client = this.conn.getClient();
    const out = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (!out.Table) {
      throw new Error(`Table ${tableName} not found`);
    }
    return out.Table;
  }

  async scan(tableName: string, opts: ScanOptions): Promise<PageResult> {
    const doc = this.conn.getDocClient();
    const out = await doc.send(
      new ScanCommand({
        TableName: tableName,
        IndexName: opts.indexName,
        FilterExpression: opts.filterExpression,
        ExpressionAttributeValues: opts.expressionAttributeValues,
        ExpressionAttributeNames: opts.expressionAttributeNames,
        ProjectionExpression: opts.projectionExpression,
        Limit: opts.limit,
        ExclusiveStartKey: opts.exclusiveStartKey,
      }),
    );
    return {
      items: out.Items ?? [],
      lastEvaluatedKey: out.LastEvaluatedKey,
      scannedCount: out.ScannedCount,
      count: out.Count,
    };
  }

  async query(tableName: string, opts: QueryOptions): Promise<PageResult> {
    const doc = this.conn.getDocClient();
    const out = await doc.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: opts.indexName,
        KeyConditionExpression: opts.keyConditionExpression,
        FilterExpression: opts.filterExpression,
        ExpressionAttributeValues: opts.expressionAttributeValues,
        ExpressionAttributeNames: opts.expressionAttributeNames,
        Limit: opts.limit,
        ExclusiveStartKey: opts.exclusiveStartKey,
        ScanIndexForward: opts.scanIndexForward,
      }),
    );
    return {
      items: out.Items ?? [],
      lastEvaluatedKey: out.LastEvaluatedKey,
      scannedCount: out.ScannedCount,
      count: out.Count,
    };
  }

  async putItem(tableName: string, item: Record<string, any>): Promise<void> {
    const doc = this.conn.getDocClient();
    await doc.send(new PutCommand({ TableName: tableName, Item: item }));
  }

  async deleteItem(tableName: string, key: Record<string, any>): Promise<void> {
    const doc = this.conn.getDocClient();
    await doc.send(new DeleteCommand({ TableName: tableName, Key: key }));
  }

  async executePartiQL(statement: string, parameters?: any[]): Promise<PageResult> {
    const doc = this.conn.getDocClient();
    const out = await doc.send(
      new ExecuteStatementCommand({ Statement: statement, Parameters: parameters }),
    );
    return { items: (out.Items as Record<string, any>[]) ?? [], lastEvaluatedKey: out.LastEvaluatedKey };
  }

  async createTable(spec: CreateTableSpec): Promise<void> {
    const client = this.conn.getClient();
    await client.send(
      new CreateTableCommand({
        TableName: spec.tableName,
        AttributeDefinitions: spec.attributes,
        KeySchema: spec.keySchema,
        BillingMode: spec.billingMode as BillingMode,
        ProvisionedThroughput:
          spec.billingMode === 'PROVISIONED'
            ? {
                ReadCapacityUnits: spec.readCapacity ?? 5,
                WriteCapacityUnits: spec.writeCapacity ?? 5,
              }
            : undefined,
      }),
    );
  }

  async deleteTable(tableName: string): Promise<void> {
    const client = this.conn.getClient();
    await client.send(new DeleteTableCommand({ TableName: tableName }));
  }

  /** Extract the key attributes from a full item, based on table key schema. */
  extractKey(item: Record<string, any>, keyAttributeNames: string[]): Record<string, any> {
    const key: Record<string, any> = {};
    for (const name of keyAttributeNames) {
      key[name] = item[name];
    }
    return key;
  }

  /** Bulk import items via BatchWrite (chunks of 25). */
  async batchImport(tableName: string, items: Record<string, any>[]): Promise<number> {
    const doc = this.conn.getDocClient();
    let written = 0;
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: chunk.map((item) => ({ PutRequest: { Item: item } })),
          },
        }),
      );
      written += chunk.length;
    }
    return written;
  }
}
