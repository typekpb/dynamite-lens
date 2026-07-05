import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ConnectionService } from './services/connection.service';

@Component({
  selector: 'dl-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <span class="logo">🧨</span>
          <span>Dynamite&nbsp;Lens</span>
        </div>
        <nav>
          <a routerLink="/connections" routerLinkActive="active">Connections</a>
          <a routerLink="/tables" routerLinkActive="active" [class.disabled]="!hasActive()"
            >Tables</a
          >
          <a routerLink="/partiql" routerLinkActive="active" [class.disabled]="!hasActive()"
            >PartiQL</a
          >
        </nav>
        <div class="active-conn">
          @if (activeProfile(); as p) {
            <div class="muted" style="font-size:11px">CONNECTED TO</div>
            <div class="conn-name">{{ p.name }}</div>
            <span class="badge">{{ p.mode }} · {{ p.region }}</span>
          } @else {
            <div class="muted" style="font-size:12px">No active connection</div>
          }
        </div>
      </aside>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .app {
        display: flex;
        height: 100vh;
      }
      .sidebar {
        width: 220px;
        min-width: 220px;
        background: var(--bg-elev);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        padding: 16px 12px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 24px;
      }
      .logo {
        font-size: 20px;
      }
      nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      nav a {
        color: var(--text);
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
      }
      nav a:hover {
        background: var(--bg-elev-2);
      }
      nav a.active {
        background: var(--accent);
        color: #1a1200;
        font-weight: 600;
      }
      nav a.disabled {
        opacity: 0.4;
        pointer-events: none;
      }
      .active-conn {
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      }
      .conn-name {
        font-weight: 600;
        margin: 2px 0 6px;
      }
      .content {
        flex: 1;
        overflow: auto;
        padding: 24px 28px;
      }
    `,
  ],
})
export class AppComponent {
  private conn = inject(ConnectionService);
  activeProfile = computed(() => {
    this.conn.activeProfileId();
    this.conn.profiles();
    return this.conn.activeProfile;
  });
  hasActive = computed(() => !!this.activeProfile());
}
