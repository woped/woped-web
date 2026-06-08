import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import html2canvas from 'html2canvas';
import {
  DiagramType,
  ProviderModel,
  t2pHttpService,
} from '../Services/t2pHttpService';
import { ModelDisplayer } from '../utilities/modelDisplayer';

@Component({
  selector: 'app-t2p',
  templateUrl: './t2p.component.html',
  styleUrls: ['./t2p.component.css'],
})
export class T2PComponent implements OnInit {
  /** Provider/model pairs advertised by `GET /v2/models`. */
  protected providerModels: ProviderModel[] = [];
  protected providers: string[] = [];
  protected selectedProvider = '';
  protected selectedModel = '';

  protected apiKey = '';
  protected showApiKey = false;

  protected diagramType: DiagramType = 'bpmn';
  protected text = '';
  protected droppedFileName = '';

  protected loading = false;
  protected modelsError = '';
  protected errorMessage = '';
  protected hasResult = false;

  private resultXml = '';

  @ViewChild('diagram', { static: true }) diagram!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(private http: t2pHttpService) {}

  ngOnInit(): void {
    this.http.getModels().subscribe({
      next: (models) => {
        this.providerModels = models;
        this.providers = [...new Set(models.map((m) => m.provider))];
        const initial = models[0];
        if (initial) {
          this.selectedProvider = initial.provider;
          this.selectedModel = initial.model;
        }
      },
      error: () => {
        this.modelsError =
          'Could not load available models. Is the t2p backend running?';
      },
    });
  }

  protected get modelsForProvider(): ProviderModel[] {
    return this.providerModels.filter(
      (m) => m.provider === this.selectedProvider
    );
  }

  protected onProviderChange(): void {
    const models = this.modelsForProvider;
    this.selectedModel = models.length ? models[0].model : '';
  }

  protected get canGenerate(): boolean {
    return (
      !this.loading &&
      this.text.trim().length > 0 &&
      this.apiKey.trim().length > 0 &&
      this.selectedProvider !== '' &&
      this.selectedModel !== ''
    );
  }

  protected generate(): void {
    if (!this.canGenerate) {
      return;
    }
    this.errorMessage = '';
    this.loading = true;
    const text = this.replaceUmlaut(this.text.trim());

    this.http
      .generate(
        this.diagramType,
        text,
        this.apiKey.trim(),
        this.selectedProvider,
        this.selectedModel
      )
      .subscribe({
        next: (xml) => this.renderResult(xml),
        error: (err) => {
          this.loading = false;
          this.hasResult = false;
          this.errorMessage = this.formatError(err);
        },
      });
  }

  private async renderResult(xml: string): Promise<void> {
    this.resultXml = xml;
    try {
      if (this.diagramType === 'bpmn') {
        await ModelDisplayer.displayBPMN(this.diagram.nativeElement, xml);
      } else {
        ModelDisplayer.displayPNML(this.diagram.nativeElement, xml);
      }
      this.hasResult = true;
    } catch {
      this.hasResult = false;
      this.errorMessage =
        'The backend returned a model that could not be rendered.';
    } finally {
      this.loading = false;
    }
  }

  private formatError(err: any): string {
    const apiMessage = err?.error?.error?.message || err?.error?.error;
    if (apiMessage) {
      return apiMessage;
    }
    if (err?.status === 0) {
      return 'Could not reach the t2p backend.';
    }
    return `Request failed (${err?.status ?? 'unknown'}).`;
  }

  /** Some downstream tooling chokes on umlauts; transliterate before sending. */
  private replaceUmlaut(text: string): string {
    return text
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue');
  }

  // --- File input -----------------------------------------------------------

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.readFile(file);
    }
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.readFile(file);
    }
  }

  protected openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.text = reader.result as string;
      this.droppedFileName = file.name;
    };
    reader.readAsText(file);
  }

  // --- Downloads ------------------------------------------------------------

  protected downloadImage(): void {
    html2canvas(this.diagram.nativeElement).then((canvas) => {
      this.triggerDownload(
        canvas.toDataURL('image/png'),
        `t2p-${this.diagramType}.png`
      );
    });
  }

  protected downloadFile(): void {
    const extension = this.diagramType === 'bpmn' ? 'bpmn' : 'pnml';
    const href =
      'data:text/xml;charset=utf-8,' + encodeURIComponent(this.resultXml);
    this.triggerDownload(href, `t2p.${extension}`);
  }

  private triggerDownload(href: string, filename: string): void {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
