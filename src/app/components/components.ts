import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { TranslocoService } from '@ngneat/transloco';
import html2canvas from 'html2canvas';
import { p2tHttpService } from '../Services/p2tHttpService';
import { t2pHttpService } from '../Services/t2pHttpService';
import { TransformerService } from '../Services/transformerService';
import { SpinnerService } from '../utilities/SpinnerService';
import { ModelDisplayer } from '../utilities/modelDisplayer';

declare global {
  interface Window {
    fileContent: string;
    dropfileContent: string;
  }
}

interface T2PHistoryEntry {
  timestamp: Date;
  diagramType: 'bpmn' | 'petri-net';
  inputText: string;
  xml: string;
}

interface P2THistoryEntry {
  timestamp: Date;
  fileName: string;
  resultText: string;
}

@Component({
  selector: 'app-components',
  templateUrl: './components.html',
  styleUrls: ['./components.css'],
})
export class CombinedComponent {

  // ─── Tool selection ───────────────────────────────────────────────────────
  selectedTool: 't2p' | 'p2t' | null = null;

  // ─── Shared LLM config (Step 1) ───────────────────────────────────────────
  // Note: the non-LLM code paths gated behind this flag (postP2T,
  // postT2PBPMN/postT2PPetriNet) are currently unreachable from the UI on
  // purpose. Backend checks (2026-07-01) showed generate_BPMN always requires
  // a real API key/LLM call, and the classic P2T endpoint does not reliably
  // detect BPMN/PNML content either — so there is no working "no LLM" mode
  // to expose right now. Left in place in case the backend is fixed later.
  isLLMEnabled = true;
  selectedLLMProvider = 'openai';
  apiKey = '';
  apiKeyValid: boolean | null = null;
  apiKeyChecking = false;

  // ─── T2P state ────────────────────────────────────────────────────────────
  protected text = '';
  protected selectedDiagram = 'bpmn';
  protected textResult = '';
  protected responseText = '';
  protected promptingStrategy = 'few_shot';
  protected isFiledDropped = false;
  protected droppedFileName = '';
  private t2pUploadedFileType: 'text' | 'bpmn' | null = null;
  // Newest entry first (index 0). Index 0 always mirrors what's currently
  // displayed, so the history list in the UI shows .slice(1).
  protected t2pHistory: T2PHistoryEntry[] = [];

  // ─── P2T state ────────────────────────────────────────────────────────────
  response: any;
  fileType: string;
  isFileDropped = false;
  droppedFileNameP2T = '';
  showPromptInput = false;
  prompt = `Create a clearly structured and comprehensible continuous text from the given BPMN that is understandable for an uninformed reader. The text should be easy to read in the summary and contain all important content; if there are subdivided points, these are integrated into the text with suitable sentence beginnings in order to obtain a well-structured and easy-to-read text. Under no circumstances should the output contain sub-items or paragraphs, but should cover all processes in one piece!`;
  isPromptReadonly = true;
  models: string[] = [];
  selectedModel: string;
  error: string;
  modelFallbackWarning = '';
  hasPromptWarningShown = false;
  isApiKeyEntered = false;
  // Newest entry first (index 0); see t2pHistory comment above.
  protected p2tHistory: P2THistoryEntry[] = [];
  private readonly maxHistoryEntries = 10;

  // ─── ViewChild refs ───────────────────────────────────────────────────────
  @ViewChild('stepper') stepper!: MatStepper;
  @ViewChild('t2pFileInputRef') t2pFileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('apiKeyInput') apiKeyInput!: ElementRef;
  @ViewChild('fileInputRef') p2tFileInputRef!: ElementRef<HTMLInputElement>;


  constructor(
    private p2tHttpService: p2tHttpService,
    private t2pHttpService: t2pHttpService,
    private transformerService: TransformerService,
    public spinnerService: SpinnerService,
    public translocoService: TranslocoService
  ) { }

  setLanguage(lang: string): void {
    this.translocoService.setActiveLang(lang);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 – LLM Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  async validateApiKey(): Promise<void> {
    this.apiKey = this.apiKey.trim();
    if (!this.apiKey) return;
    this.apiKeyChecking = true;
    this.apiKeyValid = null;

    try {
      if (this.selectedLLMProvider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });
        this.apiKeyValid = response.ok;
      } else if (this.selectedLLMProvider === 'gemini') {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
        );
        this.apiKeyValid = response.ok;
      }
    } catch {
      this.apiKeyValid = false;
    }

    this.apiKeyChecking = false;

    if (this.apiKeyValid) {
      this.isApiKeyEntered = true;
      this.fetchModelsForProvider(this.selectedLLMProvider);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // T2P – Steps 3-5
  // ═══════════════════════════════════════════════════════════════════════════

  protected generateProcess(): void {
    document.getElementById('error-container-text')!.style.display = 'none';
    const rawText = this.text.trim();
    const text = this.replaceUmlaut(rawText);

    if (!rawText) {
      this.setErrorMessage('Please enter a process description first.');
      return;
    }

    if (
      this.selectedDiagram === 'bpmn' &&
      this.t2pUploadedFileType === 'bpmn' &&
      this.isBpmnXml(rawText)
    ) {
      ModelDisplayer.displayBPMNModel(rawText, { normalizeLayout: false });
      this.setTextResult(rawText);
      return;
    }

    this.spinnerService.show();

    if (this.isLLMEnabled) {
      // T2P backend prompts are tuned for gpt-4; prefer it over gpt-4o when available
      const t2pModel = this.selectedLLMProvider === 'openai' && this.models.includes('gpt-4')
        ? 'gpt-4'
        : this.selectedModel;
      this.t2pHttpService.postT2PWithLLM(
        text,
        this.apiKey,
        this.promptingStrategy,
        this.selectedDiagram,
        this.selectedLLMProvider,
        (response: any) => {
          this.responseText = JSON.stringify(response, null, 2);
          this.setTextResult(text);
          this.pushT2PHistory(text);
        },
        t2pModel
      );
    } else {
      if (this.selectedDiagram === 'bpmn') {
        this.t2pHttpService.postT2PBPMN(text, () => this.pushT2PHistory(text));
      }
      if (this.selectedDiagram === 'petri-net') {
        this.t2pHttpService.postT2PPetriNet(text, () => this.pushT2PHistory(text));
      }
      this.setTextResult(text);
    }
  }

  /**
   * Records a successfully generated T2P result in the in-memory history so
   * users can go back to earlier results within the session (nothing is
   * persisted across page reloads). Newest entry is always at index 0.
   */
  private pushT2PHistory(inputText: string): void {
    const xml = this.t2pHttpService.getDownloadContent();
    if (!xml) return;

    this.t2pHistory.unshift({
      timestamp: new Date(),
      diagramType: this.selectedDiagram as 'bpmn' | 'petri-net',
      inputText,
      xml,
    });
    if (this.t2pHistory.length > this.maxHistoryEntries) {
      this.t2pHistory.length = this.maxHistoryEntries;
    }
  }

  /**
   * Re-displays a past T2P result and points the download buttons at it
   * again. Rendering is deferred with setTimeout so Angular has a chance to
   * toggle the *ngIf on #model-container for the target diagram type first
   * (same pattern already used by processP2TFiles() below).
   */
  restoreT2PHistory(entry: T2PHistoryEntry): void {
    this.selectedDiagram = entry.diagramType;
    this.textResult = entry.inputText;
    this.t2pHttpService.setDownloadContent(entry.xml);

    if (entry.diagramType === 'bpmn') {
      setTimeout(() => ModelDisplayer.displayBPMNModel(entry.xml, { normalizeLayout: false }));
    } else {
      setTimeout(() => ModelDisplayer.generatePetriNet(entry.xml, 'petri-render-container'));
    }
  }

  protected async onDownloadText(): Promise<void> {
    // For BPMN, pull the current (possibly manually edited) diagram out of
    // the canvas first, so the download reflects any corrections made in
    // the editor rather than the originally generated version.
    if (this.selectedDiagram === 'bpmn') {
      const currentXml = await ModelDisplayer.getCurrentBpmnXml();
      if (currentXml) {
        this.t2pHttpService.setDownloadContent(currentXml);
      }
    }

    const filename = this.selectedDiagram === 'bpmn' ? 't2p.bpmn' : 't2p.pnml';
    this.t2pHttpService.downloadModelAsText(filename);
  }

  onDownloadImage(): void {
    const link = document.createElement('a');
    link.download = 't2p.png';

    if (this.selectedDiagram === 'petri-net') {
      const dataUrl = ModelDisplayer.lastPetriNetDataUrl;
      if (!dataUrl) return;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const element = document.getElementById('model-container')!;
      html2canvas(element).then((canvas) => {
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.processT2PFiles(files);
      this.isFiledDropped = true;
      this.droppedFileName = files[0].name;
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected selectT2PFiles(): void {
    this.t2pFileInputRef.nativeElement.click();
  }

  protected onT2PFileSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      this.processT2PFiles(files);
      this.isFiledDropped = true;
      this.droppedFileName = files[0].name;
    }
  }

  processT2PFiles(files: FileList): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const extension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();

      if (extension !== 'txt' && extension !== 'bpmn' && extension !== 'xml') {
        alert('Please upload only .txt, .bpmn or .xml files');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        window.dropfileContent = reader.result as string;
        this.text = window.dropfileContent;
        this.t2pUploadedFileType = extension === 'txt' ? 'text' : 'bpmn';
      };
      reader.readAsText(file);
    }
  }

  private isBpmnXml(text: string): boolean {
    return /<[^>]*definitions\b/i.test(text) && /bpmn/i.test(text);
  }

  protected setTextResult(text: string): void {
    this.textResult = text;
  }

  protected replaceUmlaut(text: string): string {
    return text
      .replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue')
      .replace('ß', 'ss').replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P2T – Steps 3-4
  // ═══════════════════════════════════════════════════════════════════════════

  private setErrorMessage(message: string): void {
    const errorContainer = document.getElementById('error-container-text');
    if (!errorContainer) return;

    this.spinnerService.hide();
    errorContainer.innerHTML = message;
    errorContainer.style.display = 'block';
  }

  fetchModelsForProvider(provider: string): void {
    const key = provider === 'lmstudio' ? '' : this.apiKey;
    this.p2tHttpService.getModels(key, provider).subscribe({
      next: (models) => {
        const excluded = [
          'instruct', 'embedding', 'whisper', 'tts', 'davinci', 'babbage',
          'moderation', 'transcribe', 'image', 'sora', 'audio', 'realtime',
          'search-preview', 'deep-research', 'diarize', 'codex', 'translate'
        ];
        this.models = models.filter(m =>
          !excluded.some(ex => m.toLowerCase().includes(ex))
        );
        const preferred = this.models.find(m => m === 'gpt-4');
        this.selectedModel = preferred ?? this.models[0];
      },
      error: () => {
        const fallbacks: Record<string, string> = {
          openai: 'gpt-4o',
          gemini: 'models/gemini-2.5-flash',
          lmstudio: 'local-model',
        };
        this.selectedModel = fallbacks[this.selectedLLMProvider] ?? 'gpt-4o';
        this.models = [this.selectedModel];
        this.modelFallbackWarning = `Model list unavailable — using default: ${this.selectedModel}`;
      }
    });
  }

  onModelChange(model: string): void {
    this.selectedModel = model;
  }

  generateText(): void {
    if (this.fileType === 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent, { normalizeLayout: false });
    }

    if (window.fileContent !== undefined || window.dropfileContent !== undefined) {
      this.spinnerService.show();

      // PNML: erst PNML→BPMN via Transformer, dann je nach Modus LLM- oder klassischer Endpunkt
      if (this.fileType === 'pnml') {
        this.transformerService.pnmlToBpmn(window.dropfileContent).subscribe({
          next: (bpmn: string) => {
            if (this.isLLMEnabled) {
              this.postLLMWithFallback(bpmn);
            } else {
              this.p2tHttpService.postP2T(bpmn).subscribe({
                next: (response: any) => {
                  this.spinnerService.hide();
                  this.displayText(response);
                },
                error: (err: any) => {
                  this.spinnerService.hide();
                  this.error = err;
                },
              });
            }
          },
          error: (err: any) => {
            console.error('[Transformer] Status:', err.status, '| Body:', err.error);
            this.spinnerService.hide();
            this.error = 'PNML→BPMN Transformation fehlgeschlagen: ' + (err.status ?? err);
          },
        });
        return;
      }

      if (this.isLLMEnabled) {
        this.modelFallbackWarning = '';
        this.postLLMWithFallback(window.dropfileContent);
      } else {
        this.p2tHttpService.postP2T(window.dropfileContent).subscribe({
          next: (response: any) => {
            this.spinnerService.hide();
            this.displayText(response);
          },
          error: (err: any) => {
            this.spinnerService.hide();
            this.error = err;
          },
        });
      }
    } else {
      this.displayText('No files uploaded');
    }

    this.stepper.next();
  }

  /**
   * Appends an explicit language directive to the user-editable prompt so the
   * LLM always answers in the language currently selected in the UI (DE/EN),
   * instead of defaulting to whatever language the prompt text happens to be in.
   */
  private getEffectivePrompt(): string {
    const activeLang = this.translocoService.getActiveLang();
    const languageName = activeLang === 'de' ? 'German' : 'English';
    return `${this.prompt} Please respond exclusively in ${languageName}, regardless of the language of the input.`;
  }

  private postLLMWithFallback(content: string): void {
    const fallbackModel = this.selectedLLMProvider === 'gemini' ? 'models/gemini-2.0-flash' : 'gpt-4o';
    const effectivePrompt = this.getEffectivePrompt();

    // RAG support was removed at the PO's request; the backend endpoint still
    // requires the parameter, so we pass a fixed `false` here.
    this.p2tHttpService.postP2TLLM(
      content, this.apiKey, effectivePrompt, this.selectedModel, this.selectedLLMProvider, false
    ).subscribe({
      next: (response: any) => {
        this.spinnerService.hide();
        this.displayText(response);
      },
      error: (err: any) => {
        const isServerError = typeof err === 'string' && err.includes('500');
        if (isServerError && this.selectedModel !== fallbackModel) {
          const failedModel = this.selectedModel;
          this.selectedModel = fallbackModel;
          this.modelFallbackWarning = `Model "${failedModel}" not supported by backend. Retrying with ${fallbackModel}…`;
          this.p2tHttpService.postP2TLLM(
            content, this.apiKey, effectivePrompt, this.selectedModel, this.selectedLLMProvider, false
          ).subscribe({
            next: (response: any) => {
              this.spinnerService.hide();
              this.modelFallbackWarning = `Model "${failedModel}" not supported. Used ${fallbackModel} instead.`;
              this.displayText(response);
            },
            error: (retryErr: any) => {
              this.spinnerService.hide();
              this.error = retryErr;
            },
          });
        } else {
          this.spinnerService.hide();
          this.error = err;
        }
      },
    });
  }

  editPrompt(): void {
    if (!this.hasPromptWarningShown) {
      if (confirm('Warning: Changes to the prompt are at your own risk. Would you like to continue?')) {
        this.isPromptReadonly = false;
        this.hasPromptWarningShown = true;
      }
    } else {
      this.isPromptReadonly = false;
    }
  }

  isGenerateButtonDisabled(): boolean {
    if (!this.isFileDropped) return true;
    if (this.isLLMEnabled && !this.selectedModel) return true;
    return false;
  }

  downloadText(): void {
    const text = this.response;
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    );
    element.setAttribute('download', 'p2t.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  onP2TDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.isFileDropped = true;
      this.droppedFileNameP2T = files[0].name;
      this.processP2TFiles(files);
    }
  }

  onP2TDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  selectP2TFiles(): void {
    this.p2tFileInputRef.nativeElement.click();
  }

  onP2TFileSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      this.isFileDropped = true;
      this.droppedFileNameP2T = files[0].name;
      this.processP2TFiles(files);
    }
  }

  processP2TFiles(files: FileList): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = this.getFileType(file.name);

      // Validate file type
      if (fileType !== 'bpmn' && fileType !== 'pnml') {
        alert('Please upload only .bpmn or .pnml files');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        window.dropfileContent = reader.result as string;
        this.fileType = fileType;
        setTimeout(() => this.displayModel(), 0);
      };
      reader.readAsText(file);
    }
  }

  getFileType(fileName: string): string {
    const ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    if (ext === 'pnml') return 'pnml';
    if (ext === 'bpmn') return 'bpmn';
    return '';
  }

  private displayModel(): void {
    if (this.fileType === 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent, { normalizeLayout: false });
    }
    // PNML has no visual preview in P2T — transformer converts it on generate
  }

  private displayText(response: string): void {
    this.response = this.p2tHttpService.formText(response);
    this.renderResultText(this.response);
    this.pushP2THistory(this.response);
  }

  private renderResultText(text: string): void {
    const container = document.getElementById('result');
    if (!container) return;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    if (container.firstChild) container.firstChild.remove();
    container.appendChild(paragraph);
  }

  /**
   * Records a successfully generated P2T result in the in-memory history so
   * users can go back to earlier results within the session. Newest entry
   * is always at index 0.
   */
  private pushP2THistory(resultText: string): void {
    this.p2tHistory.unshift({
      timestamp: new Date(),
      fileName: this.droppedFileNameP2T || 'model',
      resultText,
    });
    if (this.p2tHistory.length > this.maxHistoryEntries) {
      this.p2tHistory.length = this.maxHistoryEntries;
    }
  }

  /** Re-displays a past P2T text result. */
  restoreP2THistory(entry: P2THistoryEntry): void {
    this.response = entry.resultText;
    this.renderResultText(entry.resultText);
  }
}
