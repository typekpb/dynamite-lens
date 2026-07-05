import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'connections', pathMatch: 'full' },
  {
    path: 'connections',
    loadComponent: () =>
      import('./features/connections/connections.component').then((m) => m.ConnectionsComponent),
  },
  {
    path: 'tables',
    loadComponent: () =>
      import('./features/tables/tables.component').then((m) => m.TablesComponent),
  },
  {
    path: 'tables/:name',
    loadComponent: () =>
      import('./features/table-detail/table-detail.component').then((m) => m.TableDetailComponent),
  },
  {
    path: 'partiql',
    loadComponent: () =>
      import('./features/partiql/partiql.component').then((m) => m.PartiqlComponent),
  },
  { path: '**', redirectTo: 'connections' },
];
