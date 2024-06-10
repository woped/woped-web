import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class p2tHttpService {
  private apiUrl = '/p2t'; // This should match the proxy configuration
  private gptModelsUrl = '/p2t/gptModels'; // This should also match the proxy configuration

  constructor(private http: HttpClient) {}

  postP2T(text: string): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'text/plain',
      'Accept': 'text/plain',
    });

    const httpOptions = {
      headers: headers,
      responseType: 'text' as 'json',
    };

    return this.http.post<string>(`${this.apiUrl}/generateText`, text, httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  postP2TLLM(text: string, apiKey: string, prompt: string, model: string): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'text/plain',
      'Accept': 'text/plain',
    });

    let params = new HttpParams();
    if (apiKey) {
      params = params.set('apiKey', apiKey);
    }
    if (prompt) {
      params = params.set('prompt', prompt);
    }
    if (model) {
      params = params.set('gptModel', model);
    }

    const httpOptions = {
      headers: headers,
      params: params,
      responseType: 'text' as 'json',
    };

    return this.http.post<string>(`${this.apiUrl}/generateTextLLM`, text, httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  getModels(): Observable<string[]> {
    return this.http.get<string[]>(this.gptModelsUrl).pipe(
      catchError(this.handleError)
    );
  }

  formText(text: string): string {
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&#032-/g, '');
    return text;
  }

  handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage: string;
    if (error.status === 0) {
      console.error('An error occurred:', error.error);
      errorMessage = 'Client Error';
    } else {
      switch (error.status) {
        case 450:
          errorMessage = 'Text could not be generated';
          break;
        case 451:
          errorMessage = 'RPST Failure';
          break;
        case 452:
          errorMessage = 'Model could not be structured';
          break;
        case 453:
          errorMessage = 'Text could not be parsed';
          break;
        default:
          errorMessage = `Unknown Server Error: ${error.message}`;
      }
    }
    return throwError(errorMessage);
  }
}
