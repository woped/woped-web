import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

/** A provider/model pair advertised by the backend's `GET /v2/models`. */
export interface ProviderModel {
  provider: string;
  model: string;
}

/** The diagram formats the v2 API can generate. */
export type DiagramType = 'bpmn' | 'pnml';

/**
 * Client for the t2p-2.0 **v2** API.
 *
 * The v2 contract is intentionally small:
 *   - `GET  /v2/models`         -> { models: ProviderModel[] }   (no auth)
 *   - `POST /v2/generate/bpmn`  -> { result: <BPMN XML> }        (bearer auth)
 *   - `POST /v2/generate/pnml`  -> { result: <PNML XML> }        (bearer auth)
 *
 * The LLM API key is sent as a bearer token and is never persisted here.
 */
@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  private readonly baseUrl = environment.t2pApiUrl || '/t2p-api';

  constructor(private http: HttpClient) {}

  /** Fetch the provider/model pairs the backend currently supports. */
  getModels(): Observable<ProviderModel[]> {
    return this.http
      .get<{ models: ProviderModel[] }>(`${this.baseUrl}/v2/models`)
      .pipe(map((res) => res.models ?? []));
  }

  /**
   * Generate a diagram from natural-language text.
   *
   * @returns an Observable of the raw XML (BPMN or PNML) string.
   */
  generate(
    type: DiagramType,
    text: string,
    apiKey: string,
    provider: string,
    model: string
  ): Observable<string> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      }),
    };
    const body = { text, provider, model };
    return this.http
      .post<{ result: string }>(`${this.baseUrl}/v2/generate/${type}`, body, options)
      .pipe(map((res) => res.result));
  }
}
