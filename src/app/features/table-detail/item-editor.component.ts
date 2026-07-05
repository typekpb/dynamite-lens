import { Component, EventEmitter, Input, Output, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'dl-item-editor',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop" (click)="cancel.emit()">
      <div class="modal card" (click)="$event.stopPropagation()">
        <h3>{{ title }}</h3>
        <p class="muted">Edit the item as JSON. Types are inferred (string, number, boolean, list, map, null).</p>
        <textarea data-testid="item-json" [(ngModel)]="text" rows="18" spellcheck="false"></textarea>
        @if (error()) { <div class="error">{{ error() }}</div> }
        <div class="btns">
          <button class="primary" data-testid="item-save" (click)="doSave()">Save</button>
          <button (click)="cancel.emit()">Cancel</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
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
        width: 620px;
        max-width: 94vw;
      }
      h3 {
        margin-top: 0;
      }
      textarea {
        width: 100%;
      }
      .btns {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
    `,
  ],
})
export class ItemEditorComponent implements OnInit {
  @Input() title = 'Item';
  @Input() item: Record<string, any> = {};
  @Output() save = new EventEmitter<Record<string, any>>();
  @Output() cancel = new EventEmitter<void>();

  text = '{}';
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.text = JSON.stringify(this.item ?? {}, null, 2);
  }

  doSave(): void {
    this.error.set(null);
    try {
      const parsed = JSON.parse(this.text);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        throw new Error('Item must be a JSON object.');
      }
      this.save.emit(parsed);
    } catch (err: any) {
      this.error.set('Invalid JSON: ' + (err?.message ?? String(err)));
    }
  }
}
