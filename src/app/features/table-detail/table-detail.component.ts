import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TableDescription } from '@aws-sdk/client-dynamodb';
import { DynamoService, PageResult } from '../../services/dynamo.service';
import { ItemEditorComponent } from './item-editor.component';

type Mode = 'scan' | 'query';

@Component({
  selector: 'dl-table-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ItemEditorComponent],
  templateUrl: './table-detail.component.html',
  styleUrl: './table-detail.component.css',
})
export class TableDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private dynamo = inject(DynamoService);

  tableName = '';
  desc = signal<TableDescription | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  mode = signal<Mode>('scan');

  // Result state
  items = signal<Record<string, any>[]>([]);
  columns = signal<string[]>([]);
  lastKeys = signal<Record<string, any>[]>([]); // pagination stack
  currentStartKey: Record<string, any> | undefined = undefined;
  count = signal(0);
  scannedCount = signal(0);

  // Query/scan inputs
  limit = 50;
  indexName = '';
  filterExpression = '';
  keyConditionExpression = '';
  expressionValuesText = '';
  expressionNamesText = '';
  projectionExpression = '';
  scanForward = true;

  // Editor state
  editorOpen = signal(false);
  editorItem = signal<Record<string, any>>({});
  editorTitle = signal('Item');
  editorIsNew = signal(false);

  // Import/export
  fileInput: HTMLInputElement | null = null;

  keyAttributeNames = computed(() => {
    const d = this.desc();
    return (d?.KeySchema ?? []).map((k) => k.AttributeName!).filter(Boolean);
  });

  indexes = computed(() => {
    const d = this.desc();
    const gsi = (d?.GlobalSecondaryIndexes ?? []).map((i) => i.IndexName!);
    const lsi = (d?.LocalSecondaryIndexes ?? []).map((i) => i.IndexName!);
    return [...gsi, ...lsi].filter(Boolean);
  });

  ngOnInit(): void {
    this.tableName = this.route.snapshot.paramMap.get('name') ?? '';
    this.loadDescribe();
    this.runScan(true);
  }

  async loadDescribe(): Promise<void> {
    try {
      this.desc.set(await this.dynamo.describeTable(this.tableName));
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    }
  }

  private parseJsonMap(text: string): Record<string, any> | undefined {
    const t = text.trim();
    if (!t) return undefined;
    return JSON.parse(t);
  }

  private setResult(res: PageResult, reset: boolean): void {
    this.items.set(res.items);
    this.count.set(res.count ?? res.items.length);
    this.scannedCount.set(res.scannedCount ?? res.items.length);
    // Compute union of columns for the table view.
    const cols = new Set<string>();
    for (const it of res.items) for (const k of Object.keys(it)) cols.add(k);
    // Put key attributes first.
    const keys = this.keyAttributeNames();
    const ordered = [...keys.filter((k) => cols.has(k)), ...[...cols].filter((c) => !keys.includes(c))];
    this.columns.set(ordered);
    this.currentStartKey = res.lastEvaluatedKey;
    if (reset) this.lastKeys.set([]);
  }

  async runScan(reset = true): Promise<void> {
    this.mode.set('scan');
    this.error.set(null);
    this.loading.set(true);
    try {
      const res = await this.dynamo.scan(this.tableName, {
        indexName: this.indexName || undefined,
        filterExpression: this.filterExpression || undefined,
        expressionAttributeValues: this.parseJsonMap(this.expressionValuesText),
        expressionAttributeNames: this.parseJsonMap(this.expressionNamesText),
        projectionExpression: this.projectionExpression || undefined,
        limit: this.limit || undefined,
        exclusiveStartKey: reset ? undefined : this.currentStartKey,
      });
      this.setResult(res, reset);
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async runQuery(reset = true): Promise<void> {
    this.mode.set('query');
    this.error.set(null);
    if (!this.keyConditionExpression.trim()) {
      this.error.set('Query requires a Key Condition Expression, e.g. pk = :pk');
      return;
    }
    this.loading.set(true);
    try {
      const res = await this.dynamo.query(this.tableName, {
        indexName: this.indexName || undefined,
        keyConditionExpression: this.keyConditionExpression,
        filterExpression: this.filterExpression || undefined,
        expressionAttributeValues: this.parseJsonMap(this.expressionValuesText),
        expressionAttributeNames: this.parseJsonMap(this.expressionNamesText),
        limit: this.limit || undefined,
        exclusiveStartKey: reset ? undefined : this.currentStartKey,
        scanIndexForward: this.scanForward,
      });
      this.setResult(res, reset);
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    } finally {
      this.loading.set(false);
    }
  }

  run(reset = true): void {
    if (this.mode() === 'query') this.runQuery(reset);
    else this.runScan(reset);
  }

  nextPage(): void {
    if (!this.currentStartKey) return;
    // push a marker for potential back navigation (kept simple: forward-only paging)
    this.run(false);
  }

  hasNext = computed(() => !!this.currentStartKey);

  // ---- Item editing ----
  addItem(): void {
    const skeleton: Record<string, any> = {};
    for (const k of this.keyAttributeNames()) skeleton[k] = '';
    this.editorItem.set(skeleton);
    this.editorTitle.set('New item');
    this.editorIsNew.set(true);
    this.editorOpen.set(true);
  }

  editItem(item: Record<string, any>): void {
    this.editorItem.set(JSON.parse(JSON.stringify(item)));
    this.editorTitle.set('Edit item');
    this.editorIsNew.set(false);
    this.editorOpen.set(true);
  }

  async onEditorSave(item: Record<string, any>): Promise<void> {
    this.error.set(null);
    try {
      await this.dynamo.putItem(this.tableName, item);
      this.editorOpen.set(false);
      this.run(true);
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    }
  }

  async deleteItem(item: Record<string, any>): Promise<void> {
    const key = this.dynamo.extractKey(item, this.keyAttributeNames());
    if (!confirm('Delete item with key ' + JSON.stringify(key) + '?')) return;
    this.error.set(null);
    try {
      await this.dynamo.deleteItem(this.tableName, key);
      this.run(true);
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    }
  }

  cell(item: Record<string, any>, col: string): string {
    const v = item[col];
    if (v === undefined) return '';
    if (v === null) return 'null';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  // ---- Export / Import ----
  exportJson(): void {
    const blob = new Blob([JSON.stringify(this.items(), null, 2)], { type: 'application/json' });
    this.download(blob, `${this.tableName}-items.json`);
  }

  exportCsv(): void {
    const cols = this.columns();
    const escape = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const rows = [cols.map(escape).join(',')];
    for (const it of this.items()) {
      rows.push(cols.map((c) => escape(this.cell(it, c))).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    this.download(blob, `${this.tableName}-items.csv`);
  }

  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async onImportFile(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.error.set(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items: Record<string, any>[] = Array.isArray(data) ? data : [data];
      const n = await this.dynamo.batchImport(this.tableName, items);
      alert(`Imported ${n} item(s).`);
      this.run(true);
    } catch (err: any) {
      this.error.set('Import failed: ' + (err?.message ?? String(err)));
    } finally {
      input.value = '';
    }
  }
}
