import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { TranslocoService } from '@ngneat/transloco';
import html2canvas from 'html2canvas';
import { p2tHttpService } from '../Services/p2tHttpService';
import { t2pHttpService, T2PModelOption } from '../Services/t2pHttpService';
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

  // T2P calls the t2p-2.0 connector directly, which currently only supports
  // a small, explicit registry of provider/model pairs (fetched live from
  // /v2/generate's /v2/models) — distinct from and usually smaller than the
  // full provider catalog used for P2T's `models`/`selectedModel` below.
  // Keeping this list separate guarantees whatever is selected here is
  // actually accepted by the T2P backend.
  protected t2pModels: T2PModelOption[] = [];
  protected t2pSelectedModel = '';

  // Models discovered directly from the provider with the user's own API key
  // during validateApiKey(). Root cause found 2026-07-17: the T2P connector's
  // fallback registry advertises models that providers have since retired
  // (gemini-2.0-flash was shut down by Google on 2026-06-01), while its
  // request validation checks against a LIVE model list fetched with the
  // caller's key. So the only reliable source for offerable models is the
  // user's own key — the registry alone can be stale and cause guaranteed
  // upstream failures.
  private discoveredProviderModels: Record<string, string[]> = {};

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
  ) {
    this.loadT2PModels();
  }

  setLanguage(lang: string): void {
    this.translocoService.setActiveLang(lang);
  }

  /**
   * Models offered in the T2P dropdown for the current provider: the
   * connector registry merged with models discovered live via the user's own
   * API key. Once the live list is known, registry entries the user's key
   * cannot access (e.g. retired models such as gemini-2.0-flash) are dropped,
   * because the connector validates each request against exactly that live
   * list and would reject them anyway.
   */
  protected get t2pModelOptions(): string[] {
    const registry = this.t2pModels
      .filter((m) => m.provider === this.selectedLLMProvider)
      .map((m) => m.model);
    const discovered = (this.discoveredProviderModels[this.selectedLLMProvider] || [])
      .filter((m) => this.isT2pCompatibleModel(m));

    if (discovered.length === 0) {
      return registry;
    }

    const aliveRegistry = registry.filter((m) => discovered.includes(m));
    return Array.from(new Set([...aliveRegistry, ...discovered]));
  }

  /** True once the registry has loaded and the current provider has no registered model. */
  protected get t2pModelUnavailable(): boolean {
    return this.t2pModels.length > 0 && this.t2pModelOptions.length === 0;
  }

  /**
   * Whether a user-key-discovered model is offerable for T2P. The connector
   * (t2p-llm-api-connector) uses chat/generateContent APIs; for OpenAI it
   * also handles the GPT-5 temperature quirk itself, so the gpt-* family is
   * fine — but non-chat models (audio/realtime/image/etc.) are not.
   */
  private isT2pCompatibleModel(model: string): boolean {
    const id = model.toLowerCase();
    if (this.selectedLLMProvider === 'gemini') {
      return id.startsWith('gemini-');
    }
    if (this.selectedLLMProvider === 'openai') {
      const excluded = [
        'audio', 'realtime', 'image', 'tts', 'transcribe', 'search',
        'instruct', 'codex', 'embedding', 'moderation',
      ];
      return id.startsWith('gpt-') && !excluded.some((ex) => id.includes(ex));
    }
    return false;
  }

  /**
   * Preferred default for the T2P dropdown: a registry-backed, known-good
   * model when available, otherwise the first offerable one.
   */
  private pickDefaultT2pModel(): string {
    const options = this.t2pModelOptions;
    if (options.length === 0) return '';

    const preferred = this.selectedLLMProvider === 'gemini'
      ? ['gemini-2.5-flash', 'gemini-3-flash', 'gemini-2.5-pro']
      : ['gpt-5-mini', 'gpt-4o', 'gpt-4.1'];
    for (const candidate of preferred) {
      if (options.includes(candidate)) return candidate;
    }
    return options[0];
  }

  /**
   * Loads the connector's actual provider/model registry (public, no API key
   * needed) so the T2P model dropdown only ever offers choices the backend
   * will accept.
   */
  private loadT2PModels(): void {
    this.t2pHttpService.getV2Models().subscribe({
      next: (models) => {
        this.t2pModels = models;
        this.t2pSelectedModel = this.pickDefaultT2pModel();
      },
      error: () => {
        this.t2pModels = [];
        this.t2pSelectedModel = this.pickDefaultT2pModel();
      },
    });
  }

  /** Keeps the T2P model selection in sync when the provider (Step 1) changes. */
  protected onProviderChange(provider: string): void {
    this.selectedLLMProvider = provider;
    this.t2pSelectedModel = this.pickDefaultT2pModel();
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
        if (response.ok) {
          // Remember what this key can actually access — see the comment on
          // discoveredProviderModels for why this matters.
          try {
            const data = await response.json();
            this.discoveredProviderModels['openai'] = (data.data || [])
              .map((m: any) => m.id as string)
              .filter(Boolean)
              .sort();
          } catch {
            // Validation succeeded; list parsing is best-effort only.
          }
        }
      } else if (this.selectedLLMProvider === 'gemini') {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${this.apiKey}`
        );
        this.apiKeyValid = response.ok;
        if (response.ok) {
          try {
            const data = await response.json();
            this.discoveredProviderModels['gemini'] = (data.models || [])
              .filter((m: any) =>
                (m.supportedGenerationMethods || []).includes('generateContent')
              )
              .map((m: any) => ((m.name as string) || '').replace(/^models\//, ''))
              .filter(Boolean)
              .sort();
          } catch {
            // Validation succeeded; list parsing is best-effort only.
          }
        }
      }
    } catch {
      this.apiKeyValid = false;
    }

    this.apiKeyChecking = false;

    if (this.apiKeyValid) {
      this.isApiKeyEntered = true;
      this.fetchModelsForProvider(this.selectedLLMProvider);
      // Re-pick the T2P default now that the live model list is known (the
      // previous selection may reference a registry model this key can't use).
      this.t2pSelectedModel = this.pickDefaultT2pModel();
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
      if (!this.t2pSelectedModel) {
        this.spinnerService.hide();
        this.setErrorMessage(
          this.t2pModelUnavailable
            ? `No model registered for provider "${this.selectedLLMProvider}" — try a different provider in Step 1.`
            : 'Loading available models, please try again in a moment.'
        );
        return;
      }
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
        this.t2pSelectedModel
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
      setTimeout(() => ModelDisplayer.generatePetriNet(entry.xml, 'model-container'));
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

  /**
   * Whether a model can actually complete a P2T generation. The p2t backend
   * (OpenAiProvider.java) always calls the chat-completions API with an
   * explicit temperature of 0.7 — reasoning models (o1/o3/o4...), the GPT-5
   * family (default-temperature-only) and non-chat models (dall-e,
   * chatgpt-*-latest aliases, computer-use) therefore fail server-side with
   * a 500 even though they appear in the /gptModels list. Offering them in
   * the dropdown produced the "works in the fat client but not on the web"
   * reports: the fat client remembers the user's last manually chosen
   * (working) model, while the web client auto-picked the first list entry.
   */
  private isP2TCompatibleModel(model: string): boolean {
    const id = model.toLowerCase();
    if (this.selectedLLMProvider === 'openai') {
      return id.startsWith('gpt-') && !id.startsWith('gpt-5');
    }
    if (this.selectedLLMProvider === 'gemini') {
      const bare = id.replace(/^models\//, '');
      return bare.startsWith('gemini-') || bare.startsWith('gemma-');
    }
    return true; // lmstudio: whatever is loaded locally
  }

  /** Known-good default for P2T; falls back to the first offered model. */
  private pickDefaultP2TModel(): string {
    const preferred = this.selectedLLMProvider === 'gemini'
      ? ['models/gemini-2.5-flash', 'models/gemini-3-flash', 'models/gemini-2.5-pro']
      : ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini'];
    for (const candidate of preferred) {
      if (this.models.includes(candidate)) return candidate;
    }
    return this.models[0];
  }

  fetchModelsForProvider(provider: string): void {
    const key = provider === 'lmstudio' ? '' : this.apiKey;
    this.modelFallbackWarning = '';
    this.p2tHttpService.getModels(key, provider).subscribe({
      next: (models) => {
        const excluded = [
          'instruct', 'embedding', 'whisper', 'tts', 'davinci', 'babbage',
          'moderation', 'transcribe', 'image', 'sora', 'audio', 'realtime',
          'search-preview', 'deep-research', 'diarize', 'codex', 'translate',
          'aqa', 'imagen', 'veo'
        ];
        this.models = models.filter(m =>
          !excluded.some(ex => m.toLowerCase().includes(ex)) &&
          this.isP2TCompatibleModel(m)
        );
        if (this.models.length === 0) {
          this.selectedModel = undefined;
          this.modelFallbackWarning =
            `No usable models were returned for ${provider}. Please verify your API key and try again.`;
          return;
        }
        this.selectedModel = this.pickDefaultP2TModel();
      },
      // Previously this silently substituted a hardcoded guessed model
      // (e.g. 'gpt-4o') whenever the model list failed to load, for any
      // reason — hiding the real cause and then often failing a second time
      // downstream with a confusing "Model is not available"/"Client Error"
      // once generation was attempted with that guessed, possibly no-longer-
      // supported model. We now surface the actual error (p2tHttpService
      // already maps it to a readable string, e.g. "Invalid OpenAI API key")
      // and leave no model selected, so isGenerateButtonDisabled() blocks
      // generation until the user fixes the underlying problem instead of
      // silently attempting one with an unverified model.
      error: (err) => {
        this.models = [];
        this.selectedModel = undefined;
        this.modelFallbackWarning = `Could not load model list: ${err}. Please check your API key and try again.`;
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
            // The transformer answers errors as plain text; Angular's JSON
            // parse failure then wraps the raw body in err.error.text. Show
            // the actual description (minus the "open an issue" boilerplate)
            // instead of just a bare status code.
            const rawBody: string | undefined =
              typeof err?.error === 'string' ? err.error : err?.error?.text;
            const description = rawBody
              ? rawBody.split('Please open an issue')[0].replace('Error description:', '').trim()
              : String(err?.status ?? err);
            this.error = 'PNML→BPMN Transformation fehlgeschlagen: ' + description;
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
    // Note: gemini-2.0-flash was retired by Google on 2026-06-01 and must not
    // be used as a retry target anymore.
    const fallbackModel = this.selectedLLMProvider === 'gemini' ? 'models/gemini-2.5-flash' : 'gpt-4o';
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
    } else if (this.fileType === 'pnml') {
      // Render the uploaded Petri net via vis.js so P2T shows a preview for
      // PNML uploads just like it does for BPMN uploads.
      ModelDisplayer.generatePetriNet(window.dropfileContent, 'model-container');
    }
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
