import { Component, ElementRef, ViewChild } from '@angular/core';
import { p2tHttpService } from '../Services/p2tHttpService';
import { ModelDisplayer } from '../utilities/modelDisplayer';

type Mode = 'algorithm' | 'llm';
type FileType = 'bpmn' | 'pnml' | '';

const DEFAULT_PROMPT = `Create a clearly structured and comprehensible continuous text from the given BPMN that is understandable for an uninformed reader. The text should be easy to read in the summary and contain all important content; if there are subdivided points, these are integrated into the text with suitable sentence beginnings in order to obtain a well-structured and easy-to-read text. Under no circumstances should the output contain sub-items or paragraphs, but should cover all processes in one piece!`;

@Component({
  selector: 'app-p2t',
  templateUrl: './p2t.component.html',
  styleUrls: ['./p2t.component.css'],
})
export class P2tComponent {
  protected mode: Mode = 'algorithm';

  // Uploaded model
  protected modelContent = '';
  protected fileType: FileType = '';
  protected fileName = '';

  // LLM configuration
  protected readonly providers = ['openAi', 'gemini', 'lmStudio'];
  protected selectedProvider = 'openAi';
  protected apiKey = '';
  protected showApiKey = false;
  protected models: string[] = [];
  protected selectedModel = '';
  protected useRag = false;
  protected prompt = DEFAULT_PROMPT;
  protected promptEditable = false;
  protected loadingModels = false;

  // Output
  protected loading = false;
  protected resultText = '';
  protected errorMessage = '';

  @ViewChild('diagram', { static: true }) diagram!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(private p2t: p2tHttpService) {}

  protected get isLLM(): boolean {
    return this.mode === 'llm';
  }

  /** Providers other than LM Studio require an API key before listing models. */
  protected get needsApiKey(): boolean {
    return this.selectedProvider !== 'lmStudio';
  }

  protected onProviderChange(): void {
    this.models = [];
    this.selectedModel = '';
    this.maybeFetchModels();
  }

  protected onApiKeyChange(): void {
    this.maybeFetchModels();
  }

  private maybeFetchModels(): void {
    if (this.needsApiKey && !this.apiKey.trim()) {
      return;
    }
    this.loadingModels = true;
    const key = this.needsApiKey ? this.apiKey.trim() : null;
    this.p2t.getModels(key as string, this.selectedProvider).subscribe({
      next: (models) => {
        this.models = models || [];
        this.selectedModel = this.models[0] ?? '';
        this.loadingModels = false;
      },
      error: () => {
        this.models = [];
        this.loadingModels = false;
        this.errorMessage = 'Could not load models for this provider.';
      },
    });
  }

  protected get canGenerate(): boolean {
    if (this.loading || !this.modelContent) {
      return false;
    }
    if (this.isLLM) {
      if (this.needsApiKey && !this.apiKey.trim()) {
        return false;
      }
      return !!this.selectedModel;
    }
    return true;
  }

  protected generate(): void {
    if (!this.canGenerate) {
      return;
    }
    this.errorMessage = '';
    this.resultText = '';
    this.loading = true;

    const request = this.isLLM
      ? this.p2t.postP2TLLM(
          this.modelContent,
          this.apiKey.trim(),
          this.prompt,
          this.selectedModel,
          this.selectedProvider,
          this.useRag
        )
      : this.p2t.postP2T(this.modelContent);

    request.subscribe({
      next: (response) => {
        this.resultText = this.p2t.formText(response);
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = typeof err === 'string' ? err : 'Text could not be generated.';
        this.loading = false;
      },
    });
  }

  protected togglePromptEditable(): void {
    this.promptEditable = !this.promptEditable;
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
      this.modelContent = reader.result as string;
      this.fileName = file.name;
      this.fileType = this.detectType(file.name);
      this.renderModel();
    };
    reader.readAsText(file);
  }

  private detectType(fileName: string): FileType {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext === 'bpmn' || ext === 'pnml' ? ext : '';
  }

  private renderModel(): void {
    if (this.fileType === 'bpmn') {
      ModelDisplayer.displayBPMN(this.diagram.nativeElement, this.modelContent).catch(
        () => {
          this.errorMessage = 'The uploaded BPMN could not be rendered.';
        }
      );
    } else if (this.fileType === 'pnml') {
      ModelDisplayer.displayPNML(this.diagram.nativeElement, this.modelContent);
    }
  }

  // --- Download -------------------------------------------------------------

  protected downloadText(): void {
    const href =
      'data:text/plain;charset=utf-8,' + encodeURIComponent(this.resultText);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'p2t.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
