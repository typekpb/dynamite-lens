import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConnectionProfile, emptyProfile } from '../../models/connection';
import { ConnectionService } from '../../services/connection.service';
import { DynamoService } from '../../services/dynamo.service';

@Component({
  selector: 'dl-connections',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Connections</h1>
    <p class="muted">
      Profiles are stored in your browser (localStorage). Choose <b>Local</b> for DynamoDB Local, or
      <b>AWS</b> for a real account. For real AWS behind the bundled proxy, set the endpoint to
      <code>/aws</code>.
    </p>

    <div class="layout">
      <div class="list card">
        <div class="list-head">
          <h3>Profiles</h3>
          <button class="primary" data-testid="new-profile" (click)="newProfile()">+ New</button>
        </div>
        @if (profiles().length === 0) {
          <p class="muted">No profiles yet. Create one to get started.</p>
        }
        @for (p of profiles(); track p.id) {
          <div class="profile-row" [class.selected]="editing()?.id === p.id">
            <div class="pinfo" (click)="edit(p)">
              <div class="pname">
                {{ p.name || '(unnamed)' }}
                @if (activeId() === p.id) {
                  <span class="badge" style="border-color:var(--success);color:var(--success)"
                    >active</span
                  >
                }
              </div>
              <div class="muted mono" style="font-size:11px">
                {{ p.mode }} · {{ p.region }} · {{ p.endpoint || 'aws default' }}
              </div>
            </div>
            <div class="pactions">
              <button (click)="activate(p)">Connect</button>
              <button class="danger" (click)="remove(p)">✕</button>
            </div>
          </div>
        }
      </div>

      @if (editing(); as e) {
        <div class="editor card">
          <h3>{{ isNew() ? 'New profile' : 'Edit profile' }}</h3>
          <div class="field">
            <label>Name</label>
            <input data-testid="conn-name" [(ngModel)]="e.name" placeholder="My local DynamoDB" />
          </div>
          <div class="row">
            <div class="field">
              <label>Mode</label>
              <select data-testid="conn-mode" [(ngModel)]="e.mode" (ngModelChange)="onModeChange(e)">
                <option value="local">Local (DynamoDB Local)</option>
                <option value="aws">AWS (real account)</option>
              </select>
            </div>
            <div class="field">
              <label>Region</label>
              <input data-testid="conn-region" [(ngModel)]="e.region" placeholder="us-east-1" />
            </div>
          </div>
          <div class="field">
            <label>Endpoint {{ e.mode === 'aws' ? '(optional — use /aws for proxy)' : '' }}</label>
            <input data-testid="conn-endpoint" [(ngModel)]="e.endpoint" placeholder="http://localhost:8000" />
          </div>
          <div class="row">
            <div class="field">
              <label>Access Key ID</label>
              <input data-testid="conn-accesskey" [(ngModel)]="e.accessKeyId" />
            </div>
            <div class="field">
              <label>Secret Access Key</label>
              <input data-testid="conn-secretkey" type="password" [(ngModel)]="e.secretAccessKey" />
            </div>
          </div>
          <div class="field">
            <label>Session Token (optional)</label>
            <input [(ngModel)]="e.sessionToken" />
          </div>

          @if (testError()) {
            <div class="error">{{ testError() }}</div>
          }
          @if (testOk()) {
            <div class="error" style="color:var(--success);border-color:var(--success);background:rgba(34,197,94,0.1)">
              ✓ Connected — {{ tableCount() }} table(s) found.
            </div>
          }

          <div class="btns">
            <button class="primary" (click)="save(e)">Save</button>
            <button (click)="testConnection(e)" [disabled]="testing()">
              @if (testing()) { <span class="spinner"></span> } Test
            </button>
            <button (click)="cancel()">Cancel</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        align-items: start;
        margin-top: 16px;
      }
      .list-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      h3 {
        margin: 0 0 8px;
      }
      .profile-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid transparent;
      }
      .profile-row:hover {
        background: var(--bg-elev-2);
      }
      .profile-row.selected {
        border-color: var(--accent);
      }
      .pinfo {
        cursor: pointer;
        flex: 1;
      }
      .pname {
        font-weight: 600;
      }
      .pactions {
        display: flex;
        gap: 6px;
      }
      .btns {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
    `,
  ],
})
export class ConnectionsComponent {
  private conn = inject(ConnectionService);
  private dynamo = inject(DynamoService);
  private router = inject(Router);

  profiles = this.conn.profiles;
  activeId = this.conn.activeProfileId;

  editing = signal<ConnectionProfile | null>(null);
  isNew = signal(false);
  testing = signal(false);
  testError = signal<string | null>(null);
  testOk = signal(false);
  tableCount = signal(0);

  newProfile(): void {
    this.editing.set(emptyProfile());
    this.isNew.set(true);
    this.resetTest();
  }

  edit(p: ConnectionProfile): void {
    this.editing.set({ ...p });
    this.isNew.set(false);
    this.resetTest();
  }

  cancel(): void {
    this.editing.set(null);
    this.resetTest();
  }

  onModeChange(e: ConnectionProfile): void {
    if (e.mode === 'aws') {
      if (!e.endpoint || e.endpoint === 'http://localhost:8000') {
        e.endpoint = `/aws/${e.region || 'us-east-1'}`;
      }
      if (e.accessKeyId === 'local') e.accessKeyId = '';
      if (e.secretAccessKey === 'local') e.secretAccessKey = '';
    } else {
      if (!e.endpoint || e.endpoint.startsWith('/aws')) e.endpoint = '/local';
    }
  }


  save(e: ConnectionProfile): void {
    this.conn.saveProfile({ ...e });
    this.editing.set(null);
  }

  remove(p: ConnectionProfile): void {
    if (confirm(`Delete profile "${p.name || '(unnamed)'}"?`)) {
      this.conn.deleteProfile(p.id);
      if (this.editing()?.id === p.id) this.editing.set(null);
    }
  }

  activate(p: ConnectionProfile): void {
    this.conn.saveProfile({ ...p });
    this.conn.setActive(p.id);
    this.router.navigate(['/tables']);
  }

  async testConnection(e: ConnectionProfile): Promise<void> {
    this.resetTest();
    this.testing.set(true);
    // Temporarily persist + activate to reuse the client factory.
    this.conn.saveProfile({ ...e });
    const prevActive = this.conn.activeProfileId();
    this.conn.setActive(e.id);
    try {
      const tables = await this.dynamo.listTables();
      this.tableCount.set(tables.length);
      this.testOk.set(true);
    } catch (err: any) {
      this.testError.set(err?.message ?? String(err));
      this.conn.setActive(prevActive);
    } finally {
      this.testing.set(false);
    }
  }

  private resetTest(): void {
    this.testError.set(null);
    this.testOk.set(false);
    this.tableCount.set(0);
  }
}
