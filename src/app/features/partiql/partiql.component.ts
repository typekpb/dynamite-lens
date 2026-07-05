import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamoService } from '../../services/dynamo.service';

interface SavedQuery {
  id: string;
  name: string;
  statement: string;
}

const SAVED_KEY = 'dl.savedQueries';

@Component({
  selector: 'dl-partiql',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>PartiQL</h1>
    <p class="muted">
      Run PartiQL statements (SELECT / INSERT / UPDATE / DELETE). Use <code>?</code> placeholders and
      supply parameters as a JSON array below.
    </p>

    <div class="editor card">
      <textarea
        class="mono"
        rows="6"
        data-testid="pql-statement"
        [(ngModel)]="statement"
        spellcheck="false"
        placeholder='SELECT * FROM "MyTable" WHERE pk = ?'
      ></textarea>
      <div class="field">
        <label>Parameters (JSON array, optional)</label>
        <input class="mono" [(ngModel)]="paramsText" placeholder='[ "USER#1" ]' />
      </div>
      <div class="btns">
        <button class="primary" data-testid="pql-execute" (click)="run()" [disabled]="running()">
          @if (running()) { <span class="spinner"></span> } Execute
        </button>
        <button (click)="save()">Save query</button>
      </div>
    </div>

    @if (saved().length) {
      <div class="saved">
        <span class="muted">Saved:</span>
        @for (q of saved(); track q.id) {
          <span class="badge saved-item" (click)="load(q)"
            >{{ q.name }} <em (click)="remove(q, $event)">✕</em></span
          >
        }
      </div>
    }

    @if (error()) {
      <div class="error">{{ error() }}</div>
    }

    @if (rows().length) {
      <div class="result-bar">
        <span class="muted">{{ rows().length }} row(s)</span>
      </div>
      <div class="card table-wrap" style="padding:0">
        <table>
          <thead>
            <tr>
              @for (c of columns(); track c) { <th class="mono">{{ c }}</th> }
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track $index) {
              <tr>
                @for (c of columns(); track c) {
                  <td class="mono" [title]="cell(r, c)">{{ cell(r, c) }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (executed()) {
      <p class="muted">Statement executed. No rows returned.</p>
    }
  `,
  styles: [
    `
      .editor {
        margin-bottom: 12px;
      }
      textarea {
        width: 100%;
        margin-bottom: 10px;
      }
      .btns {
        display: flex;
        gap: 8px;
      }
      .saved {
        margin: 8px 0;
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .saved-item {
        cursor: pointer;
      }
      .saved-item em {
        color: var(--danger);
        margin-left: 4px;
        font-style: normal;
      }
      .result-bar {
        margin: 12px 0 8px;
      }
      .table-wrap {
        overflow: auto;
        max-height: 60vh;
      }
    `,
  ],
})
export class PartiqlComponent {
  private dynamo = inject(DynamoService);

  statement = '';
  paramsText = '';
  running = signal(false);
  executed = signal(false);
  error = signal<string | null>(null);
  rows = signal<Record<string, any>[]>([]);
  saved = signal<SavedQuery[]>(this.loadSaved());

  columns = computed(() => {
    const cols = new Set<string>();
    for (const r of this.rows()) for (const k of Object.keys(r)) cols.add(k);
    return [...cols];
  });

  async run(): Promise<void> {
    this.error.set(null);
    this.executed.set(false);
    if (!this.statement.trim()) {
      this.error.set('Enter a PartiQL statement.');
      return;
    }
    let params: any[] | undefined;
    try {
      const t = this.paramsText.trim();
      params = t ? JSON.parse(t) : undefined;
      if (params && !Array.isArray(params)) throw new Error('Parameters must be a JSON array.');
    } catch (err: any) {
      this.error.set('Invalid parameters JSON: ' + (err?.message ?? String(err)));
      return;
    }
    this.running.set(true);
    try {
      const res = await this.dynamo.executePartiQL(this.statement, params);
      this.rows.set(res.items);
      this.executed.set(true);
    } catch (err: any) {
      this.error.set(err?.message ?? String(err));
    } finally {
      this.running.set(false);
    }
  }

  cell(item: Record<string, any>, col: string): string {
    const v = item[col];
    if (v === undefined) return '';
    if (v === null) return 'null';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  private loadSaved(): SavedQuery[] {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistSaved(): void {
    localStorage.setItem(SAVED_KEY, JSON.stringify(this.saved()));
  }

  save(): void {
    if (!this.statement.trim()) return;
    const name = prompt('Name this query:');
    if (!name) return;
    this.saved.set([...this.saved(), { id: crypto.randomUUID(), name, statement: this.statement }]);
    this.persistSaved();
  }

  load(q: SavedQuery): void {
    this.statement = q.statement;
  }

  remove(q: SavedQuery, evt: Event): void {
    evt.stopPropagation();
    this.saved.set(this.saved().filter((x) => x.id !== q.id));
    this.persistSaved();
  }
}
