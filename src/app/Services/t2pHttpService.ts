import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, timeout } from 'rxjs/operators';
import { SpinnerService } from '../utilities/SpinnerService';
import { ModelDisplayer } from '../utilities/modelDisplayer';
import { TransformerService } from './transformerService';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
  responseType: 'text' as 'json',
};

export interface T2PModelOption {
  provider: string;
  model: string;
}

@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  // Legacy endpoints. Deprecated per docs/api-contract.md (sunset 1 Dec 2026);
  // still used only by the dead/UI-unreachable non-LLM paths below
  // (postT2PBPMN/postT2PPetriNet). The live LLM path uses the v2 endpoints.
  private urlBPMN = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/generate_BPMN';
  private urlPetriNet = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/generate_PNML';

  // Current (v2) endpoints — confirmed against the live openapi.json
  // (2026-07-03). Require `Authorization: Bearer <api_key>` and a JSON body
  // of { text, provider, model, prompting_strategy? }; response is
  // { result: string }. /v2/generate/pnml performs the BPMN->PNML transform
  // and layout assignment server-side.
  //
  // KNOWN BACKEND ISSUE (2026-07-05, reported to backend team, kept
  // deliberately on the frontend anyway — see backend info list): live
  // testing showed /v2/generate/pnml hangs indefinitely (no error, no result,
  // 5+ minutes) whenever the underlying LLM call succeeds, while
  // /v2/generate/bpmn with an identical prompt returns normally. This isolates
  // the hang to /v2/generate/pnml's own post-generation transform/layout step
  // server-side. We keep calling /v2/generate/pnml anyway (per product
  // decision) since that's the architecturally correct endpoint and the
  // backend team owns the fix; do not silently route around it client-side.
  private urlV2BPMN = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/v2/generate/bpmn';
  private urlV2PNML = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/v2/generate/pnml';
  private urlV2Models = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/v2/models';

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

  /** Fetches the connector's actually-registered provider/model pairs for T2P. */
  public getV2Models(): Observable<T2PModelOption[]> {
    return this.t2phttpClient
      .get<{ models: T2PModelOption[] }>(this.urlV2Models)
      .pipe(map((res) => res.models || []));
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
    const isBpmn = modelType.toLowerCase().includes('bpmn') || modelType === 'bpmn';
    const isPetri =
      modelType.toLowerCase().includes('petri') ||
      modelType.toLowerCase().includes('pnml') ||
      modelType === 'petri';

    if (!isBpmn && !isPetri) {
      console.error('Unknown model type:', modelType);
      this.spinnerService.hide();
      document.getElementById('error-container-text')!.innerHTML =
        'Unknown model type: ' + modelType;
      document.getElementById('error-container-text')!.style.display = 'block';
      return;
    }

    // TEMPORARY WORKAROUND (2026-07-18, decided due to the submission
    // deadline): /v2/generate/pnml hangs server-side after a successful LLM
    // response (documented backend issue, see Backend_Infos_T2P_v2.md #1).
    // Until the backend is fixed, petri-net requests use /v2/generate/bpmn —
    // identical LLM pipeline — and the extensively verified transformer
    // service converts the result to PNML client-side (see handleSuccess).
    // Revert to `isBpmn ? this.urlV2BPMN : this.urlV2PNML` once fixed.
    const llmUrl = this.urlV2BPMN;

    const normalizedModel = (model || '').startsWith('models/')
      ? (model as string).slice('models/'.length)
      : model;

    const body: any = {
      text,
      provider: llmProvider,
      model: normalizedModel,
      prompting_strategy: approach,
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    });
    const v2HttpOptions = { headers, responseType: 'text' as 'json' };

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

      if (isBpmn) {
        ModelDisplayer.displayBPMNModel(xmlContent);
        this.warnIfDisconnected(/sequenceFlow/i.test(xmlContent));
        callback(parsedResponse);
      } else {
        // Part of the temporary workaround (see llmUrl above): the response
        // is BPMN XML, so convert it to PNML client-side via the transformer
        // service before rendering/downloading.
        this.transformerService.bpmnToPnml(xmlContent).subscribe({
          next: (pnml: string) => {
            this.plainDocumentForDownload = pnml;
            // Render visibly into the shared canvas; the vis.js afterDrawing
            // hook also captures the PNG snapshot for the download button.
            ModelDisplayer.generatePetriNet(pnml, 'model-container');
            this.warnIfDisconnected(/<arc[\s>]/i.test(pnml));
            callback(parsedResponse);
          },
          error: (err: any) => {
            this.spinnerService.hide();
            const errorEl = document.getElementById('error-container-text');
            if (errorEl) {
              // The transformer answers errors as plain text; Angular's JSON
              // parse failure wraps that raw body in err.error.text.
              const rawBody: string | undefined =
                typeof err?.error === 'string' ? err.error : err?.error?.text;
              const description = rawBody
                ? rawBody.split('Please open an issue')[0].replace('Error description:', '').trim()
                : String(err?.status ?? err);
              errorEl.innerHTML = 'BPMN to PNML transformation failed: ' + description;
              errorEl.style.display = 'block';
            }
          },
        });
      }
    };

    // Without a client-side timeout the UI spins forever when the backend
    // hangs — which /v2/generate/pnml currently does (documented backend
    // issue: it stalls after a successful LLM response). 3 minutes leaves
    // ample room for legitimate few-shot orchestration runs.
    const requestTimeoutMs = 180000;

    const handleError = (error: any, attempt: number) => {
      if (error.status === 500 && attempt < 3) {
        this.t2phttpClient.post<string>(llmUrl, body, v2HttpOptions)
          .pipe(timeout(requestTimeoutMs))
          .subscribe(
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

    return this.t2phttpClient.post<string>(llmUrl, body, v2HttpOptions)
      .pipe(timeout(requestTimeoutMs))
      .subscribe(
        (response: any) => handleSuccess(response),
        (error: any) => handleError(error, 0)
      );
  }

  /**
   * Shows a notice when the generated model has no connections between its
   * elements (no sequence flows / no arcs). This happens when the LLM's
   * process extraction misses the flows — observed especially with Gemini
   * models. The diagram is still rendered; the notice tells users why it
   * looks like a loose column of nodes and what to try instead.
   */
  private warnIfDisconnected(hasConnections: boolean): void {
    if (hasConnections) return;
    const errorEl = document.getElementById('error-container-text');
    if (!errorEl) return;
    errorEl.innerHTML =
      'The generated model contains no connections between its elements. '
      + 'This is a known weakness of some models — please generate again, '
      + 'switch the prompting strategy (e.g. Few-Shot), or try a different model/provider.';
    errorEl.style.display = 'block';
  }

  private formatError(error: any): string {
    if (error?.name === 'TimeoutError') {
      return 'The server did not respond within 3 minutes. Please try again — if the problem persists, the backend service may be unavailable.';
    }

    // v2 error shape: { error: { code: string, message: string } }. Since
    // requests use responseType 'text', a non-2xx body arrives as a raw
    // string in error.error and needs parsing first.
    let parsedBody: any = error?.error;
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch {
        // not JSON — fall through, treated as a plain string message below
      }
    }

    const code = parsedBody?.error?.code;
    const message = parsedBody?.error?.message;

    const codeHints: Record<string, string> = {
      invalid_model:
        'The AI’s response could not be parsed into a valid process model. Try again, or use a shorter/simpler description.',
      invalid_provider: 'This provider/model combination is not supported by the backend right now.',
      transform_error:
        'The Petri net transformer could not convert this process. Please use a simpler description without lanes, message flows, timers, errors, or subprocesses.',
      upstream_error: 'The LLM provider could not be reached or returned an error.',
      unauthorized: 'The API key was rejected by the backend.',
      invalid_request: 'The request was malformed or missing required fields.',
      internal_error: 'An unexpected backend error occurred.',
    };

    if (code && codeHints[code]) {
      return `${error?.status || ''} ${code}: ${codeHints[code]}${message ? ' (' + message + ')' : ''}`.trim();
    }

    const backendError =
      typeof error?.error === 'string'
        ? error.error
        : message || error?.error?.error || error?.message || 'Unknown error';

    return `${error?.status || ''} ${error?.statusText || ''} ${backendError}`.trim();
  }
}
