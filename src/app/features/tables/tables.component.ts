import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AttributeDefinition, KeySchemaElement } from '@aws-sdk/client-dynamodb';
import { ConnectionService } from '../../services/connection.service';
import { CreateTableSpec, DynamoService } from '../../services/dynamo.service';

@Component({
  selector: 'dl-tables',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="head">
      <h1>Tables</h1>
      <div class="actions">
        <button (click)="refresh()" [disabled]="loading()">Refresh</button>
        <button class="primary" data-testid="open-create" (click)="showCreate.set(true)">+ Create table</button>
      </div>
    </div>

    @if (!conn.activeProfile) {
      <div class="error">No active connection. Go to Connections and Connect to a profile.</div>
    }
    @if (error()) {
      <div class="error">{{ error() }}</div>
    }
    @if (loading()) {
      <p><span class="spinner"></span> Loading tables…</p>
    }

    <div class="field" style="max-width:320px">
      <input [(ngModel)]="filter" placeholder="Filter tables…" />
    </div>

    <div class="card" style="padding:0">
      <table>
        <thead>
          <tr>
            <th>Table name</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (t of filtered(); track t) {
            <tr>
              <td><a data-testid="table-link" [routerLink]="['/tables', t]">{{ t }}</a></td>
              <td style="text-align:right">
                <button (click)="open(t)">Explore</button>
                <button class="danger" (click)="drop(t)">Delete</button>
              </td>
            </tr>
          }
          @if (!loading() && filtered().length === 0) {
            <tr><td colspan="2" class="muted">No tables.</td></tr>
          }
        </tbody>
      </table>
    </div>

    @if (showCreate()) {
      <div class="modal-backdrop" (click)="showCreate.set(false)">
        <div class="modal card" (click)="$event.stopPropagation()">
          <h3>Create table</h3>
          <div class="field">
            <label>Table name</label>
            <input data-testid="ct-name" [(ngModel)]="ct.tableName" placeholder="MyTable" />
          </div>
          <div class="row">
            <div class="field">
              <label>Partition key (HASH)</label>
              <input data-testid="ct-pk" [(ngModel)]="pkName" placeholder="pk" />
            </div>
            <div class="field">
              <label>PK type</label>
              <select [(ngModel)]="pkType">
                <option value="S">String</option>
                <option value="N">Number</option>
                <option value="B">Binary</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label>Sort key (RANGE, optional)</label>
              <input [(ngModel)]="skName" placeholder="sk" />
            </div>
            <div class="field">
              <label>SK type</label>
              <select [(ngModel)]="skType">
                <option value="S">String</option>
                <option value="N">Number</option>
                <option value="B">Binary</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label>Billing mode</label>
            <select [(ngModel)]="ct.billingMode">
              <option value="PAY_PER_REQUEST">On-demand (PAY_PER_REQUEST)</option>
              <option value="PROVISIONED">Provisioned</option>
            </select>
          </div>
          @if (ct.billingMode === 'PROVISIONED') {
            <div class="row">
              <div class="field"><label>Read capacity</label><input type="number" [(ngModel)]="ct.readCapacity" /></div>
              <div class="field"><label>Write capacity</label><input type="number" [(ngModel)]="ct.writeCapacity" /></div>
            </div>
          }
          @if (createError()) { <div class="error">{{ createError() }}</div> }
          <div class="btns">
            <button class="primary" data-testid="ct-submit" (click)="create()" [disabled]="creating()">
              @if (creating()) { <span class="spinner"></span> } Create
            </button>
            <button (click)="showCreate.set(false)">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }
      .modal {
        width: 460px;
        max-width: 92vw;
      }
      h3 {
        margin-top: 0;
      }
      .btns {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      td button {
        margin-left: 6px;
      }
    `,
  ],
})
export class TablesComponent implements OnInit {
  conn = inject(ConnectionService);
  private dynamo = inject(DynamoService);
  private router = inject(Router);

  tables = signal<string[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  filter = '';

  showCreate = signal(false);
  creating = signal(false);
  createError = signal<string | null>(null);

  ct: CreateTableSpec = this.defaultSpec();
  pkName = 'pk';
  pkType: 'S' | 'N' | 'B' = 'S';
  skName = '';
  skType: 'S' | 'N' | 'B' = 'S';

  ngOnInit(): void {
    if (this.conn.activeProfile) this.refresh();
  }

  filtered(): string[] {
    const f = this.filter.trim().toLowerCase();
    return f ? this.tables().filter((t) => t.toLowerCase().includes(f)) : this.tables();
  }

  async refresh(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      this.tables.set(await this.dynamo.listTables());
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    } finally {
      this.loading.set(false);
    }
  }

  open(t: string): void {
    this.router.navigate(['/tables', t]);
  }

  async drop(t: string): Promise<void> {
    if (!confirm(`Delete table "${t}"? This is irreversible.`)) return;
    try {
      await this.dynamo.deleteTable(t);
      await this.refresh();
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    }
  }

  private defaultSpec(): CreateTableSpec {
    return {
      tableName: '',
      billingMode: 'PAY_PER_REQUEST',
      readCapacity: 5,
      writeCapacity: 5,
      attributes: [],
      keySchema: [],
    };
  }

  async create(): Promise<void> {
    this.createError.set(null);
    if (!this.ct.tableName || !this.pkName) {
      this.createError.set('Table name and partition key are required.');
      return;
    }
    const attributes: AttributeDefinition[] = [
      { AttributeName: this.pkName, AttributeType: this.pkType },
    ];
    const keySchema: KeySchemaElement[] = [{ AttributeName: this.pkName, KeyType: 'HASH' }];
    if (this.skName.trim()) {
      attributes.push({ AttributeName: this.skName, AttributeType: this.skType });
      keySchema.push({ AttributeName: this.skName, KeyType: 'RANGE' });
    }
    this.creating.set(true);
    try {
      await this.dynamo.createTable({ ...this.ct, attributes, keySchema });
      this.showCreate.set(false);
      this.ct = this.defaultSpec();
      this.skName = '';
      await this.refresh();
    } catch (err: any) {
      this.createError.set(err?.message ?? String(err));
    } finally {
      this.creating.set(false);
    }
  }
}
