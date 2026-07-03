import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SpinnerService } from '../utilities/SpinnerService';
import { ModelDisplayer } from '../utilities/modelDisplayer';
import { TransformerService } from './transformerService';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
  responseType: 'text' as 'json',
};

@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  private urlBPMN = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/generate_BPMN';
  private urlPetriNet = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/generate_PNML';

  private plainDocumentForDownload: string;

  constructor(
    private t2phttpClient: HttpClient,
    public spinnerService: SpinnerService,
    private transformerService: TransformerService
  ) { }

  public postT2PBPMN(text: string, onSuccess?: () => void, onError?: (error: any) => void) {
    const modelContainer = document.getElementById('model-container');
    if (modelContainer) modelContainer.innerHTML = '';

    return this.t2phttpClient
      .post<string>(this.urlBPMN, text, httpOptions)
      .subscribe(
        (response: any) => {
          this.spinnerService.hide();
          ModelDisplayer.displayBPMNModel(response);
          this.plainDocumentForDownload = response;
          onSuccess?.();
        },
        (error: any) => {
          console.log(error);
          this.spinnerService.hide();
          document.getElementById('error-container-text')!.innerHTML =
            error.status + ' ' + error.statusText + ' ' + error.error;
          document.getElementById('error-container-text')!.style.display =
            'block';
          onError?.(error);
        }
      );
  }

  /** Current content that downloadModelAsText()/PNG capture operate on. */
  public getDownloadContent(): string {
    return this.plainDocumentForDownload;
  }

  /**
   * Overrides the stored result, e.g. with a live-edited BPMN XML from the
   * canvas or a restored history entry, so subsequent downloads reflect it.
   */
  public setDownloadContent(content: string): void {
    this.plainDocumentForDownload = content;
  }

  public downloadModelAsText(filename = 't2p.pnml') {
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' +
      encodeURIComponent(this.plainDocumentForDownload)
    );
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();
    document.body.removeChild(element);
  }

  public postT2PPetriNet(text: string, onSuccess?: () => void, onError?: (error: any) => void) {
    const modelContainer = document.getElementById('model-container');
    if (modelContainer) modelContainer.innerHTML = '';
    const petriContainer = document.getElementById('petri-render-container');
    if (petriContainer) petriContainer.innerHTML = '';

    return this.t2phttpClient
      .post<string>(this.urlPetriNet, text, httpOptions)
      .subscribe(
        (response: any) => {
          this.spinnerService.hide();
          this.plainDocumentForDownload = response;
          onSuccess?.();
        },
        (error: any) => {
          this.spinnerService.hide();
          document.getElementById('error-container-text')!.innerHTML =
            this.formatError(error);
          document.getElementById('error-container-text')!.style.display =
            'block';
          onError?.(error);
        }
      );
  }

  public postT2PWithLLM(
    text: string,
    apiKey: string,
    approach: string,
    modelType: string,
    llmProvider: string,
    callback: (response: any) => void,
    model?: string
  ) {
    let llmUrl: string;
    console.log('Approach value:', approach);
    console.log('Model type:', modelType);

    if (modelType.toLowerCase().includes('bpmn') || modelType === 'bpmn') {
      llmUrl = this.urlBPMN;
      console.log('Using BPMN URL:', llmUrl);
    } else if (
      modelType.toLowerCase().includes('petri') ||
      modelType.toLowerCase().includes('pnml') ||
      modelType === 'petri'
    ) {
      llmUrl = this.urlBPMN;
      console.log('Using BPMN URL for Petri-Net (LLM path):', llmUrl);
    } else {
      console.error('Unknown model type:', modelType);
      this.spinnerService.hide();
      document.getElementById('error-container-text')!.innerHTML =
        'Unknown model type: ' + modelType;
      document.getElementById('error-container-text')!.style.display = 'block';
      return;
    }

    const body: any = {
      text,
      api_key: apiKey,
      approach,
      llm_provider: llmProvider,
    };
    if (model) {
      body.model = model.startsWith('models/')
        ? model.slice('models/'.length)
        : model;
    }

    const modelContainer = document.getElementById('model-container');
    if (modelContainer) modelContainer.innerHTML = '';
    const petriContainer = document.getElementById('petri-render-container');
    if (petriContainer) petriContainer.innerHTML = '';

    const handleSuccess = (response: any) => {
      this.spinnerService.hide();
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(response);
      } catch (e) {
        parsedResponse = { result: response };
      }
      const xmlContent = parsedResponse.result || parsedResponse;
      this.plainDocumentForDownload = xmlContent;

      if (modelType.toLowerCase().includes('bpmn') || modelType === 'bpmn') {
        ModelDisplayer.displayBPMNModel(xmlContent);
        callback(parsedResponse);
      } else if (
        modelType.toLowerCase().includes('petri') ||
        modelType.toLowerCase().includes('pnml') ||
        modelType === 'petri'
      ) {
        this.transformerService.bpmnToPnml(xmlContent).subscribe({
          next: (pnml: string) => {
            this.plainDocumentForDownload = pnml;
            // Render into the off-screen container so vis.js can capture a
            // PNG snapshot (ModelDisplayer.lastPetriNetDataUrl) for the
            // "Download Process as .png" button. This was never wired up
            // before, so Petri-net PNG downloads silently did nothing.
            ModelDisplayer.generatePetriNet(pnml, 'petri-render-container');
            callback(parsedResponse);
          },
          error: (err: any) => {
            this.spinnerService.hide();
            const errorEl = document.getElementById('error-container-text');
            if (errorEl) {
              errorEl.innerHTML = 'BPMN to PNML transformation failed: ' + err.status;
              errorEl.style.display = 'block';
            }
          }
        });
      }
    };

    const handleError = (error: any, attempt: number) => {
      if (error.status === 500 && attempt < 3) {
        this.t2phttpClient.post<string>(llmUrl, body, httpOptions).subscribe(
          (response: any) => handleSuccess(response),
          (retryError: any) => handleError(retryError, attempt + 1)
        );
      } else {
        this.spinnerService.hide();
        document.getElementById('error-container-text')!.innerHTML =
          this.formatError(error);
        document.getElementById('error-container-text')!.style.display = 'block';
      }
    };

    return this.t2phttpClient.post<string>(llmUrl, body, httpOptions).subscribe(
      (response: any) => handleSuccess(response),
      (error: any) => handleError(error, 0)
    );
  }

  private formatError(error: any): string {
    const backendError =
      typeof error?.error === 'string'
        ? error.error
        : error?.error?.error || error?.message || 'Unknown error';

    if (
      backendError.includes('BPMN to PNML transformation failed') ||
      backendError.includes('TransformerServiceError') ||
      backendError.includes('transformation service responded with an error')
    ) {
      return `${error?.status || ''} ${error?.statusText || ''} The Petri net transformer could not convert this process. Please use a simpler Petri-net description without lanes, message flows, timers, errors, or subprocesses.`;
    }

    return `${error?.status || ''} ${error?.statusText || ''} ${backendError}`.trim();
  }
}
