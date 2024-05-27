import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Component, Injectable } from '@angular/core';
import { SpinnerService } from '../utilities/SpinnerService';

declare global {
  interface Window {
    text: string;
  }
}

@Injectable({
  providedIn: 'root',
})
@Component({
  selector: 'app-my-component',
  template: ` <div>{{ asyncText }}</div>`,
})
export class p2tHttpService {
  private url = 'http://localhost:8080/p2t/generateText'; // Specifies the interface through which the text is displayed.
  asyncText: string;

  constructor(
    private http: HttpClient,
    public spinnerService: SpinnerService
  ) {}

  // This method is used to send the text to the server and to display the response.
  postP2T(text: string, apiKey: string) {
    const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json', // We send JSON
    'Accept': 'text/plain, */*'  // We send Text
  }),
  params: new HttpParams().set('apiKey', apiKey), // We send the API Key
  responseType: 'text' as 'json', // We accept plain text as response.
};
    return this.http.post<string>(this.url, text, httpOptions).subscribe(
      (response: any) => {
        // hides the spinner when the response is received.
        this.spinnerService.hide();
        this.displayText(response);
      },
      (error: any) => {
        this.spinnerService.hide();
        // Error handling User Feedback
        document.getElementById('error-box')!.style.visibility = 'visible';
        document.getElementById('error-content')!.innerHTML =
          this.handleError(error);
        document.getElementById('error-content')!.style.display = 'block';
      }
    );
  }
  // This method is used to remove the html tags from the response.
  formText(text: string): string {
    // this.spinnerService.hide();
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&#032-/g, '');
    return text;
  }

  // This method is used to display the response.
  async displayText(response: any) {
    try {
      response = this.formText(response);
      window.text = response;
      const paragraph = document.createElement('p');
      const text = document.createTextNode(response);
      // paragraph.appendChild(text);
      const container = document.getElementById('result')!;
      if (container.firstChild) {
        container.firstChild.remove();
      }
      paragraph.appendChild(text);
      container.appendChild(paragraph);
      this.spinnerService.hide();
    } catch (err) {
      console.error('error', err);
      this.spinnerService.hide();
    }
  }
  // This method is used to get the text from the server.
  getText(): string {
    return window.text;
  }
  // This method is used to handle the errors.
  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error);
      return `Client Error`;
    } else {
      switch (error.status) {
        case 450: {
          return `Text could not be generated`;
        }
        case 451: {
          return `RPST Failure`;
        }
        case 452: {
          return `Modell could not be structured`;
        }
        case 453: {
          return `Text could not be parsed`;
        }
        default: {
          return `Unknown Server Error: ${error.message}`;
        }
      }
    }
  }
}
