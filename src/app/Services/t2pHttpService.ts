import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SpinnerService } from '../utilities/SpinnerService';

import { ModelDisplayer } from '../utilities/modelDisplayer';

const httpOptions = {
  headers: new HttpHeaders({
    Accept: '*/*',
    'Content-Type': 'application/json', // We send Text
  }),
  responseType: 'text' as 'json', // We accept plain text as response.
};

@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  private urlBPMN = 'http://localhost:8081/t2p/generateBPMNv2'; // Specifies the interface through which the BPMN model is displayed. Liefert als Ergebnis eine .bpmn Datei zurück?
  private urlPetriNet = 'http://localhost:8081/t2p/generatePNML'; //Specifies the interface through which the BPMN model is displayed. Liefert als Ergebnis eine .pnml Datei zurück?

  private plainDocumentForDownload: string;

  constructor(
    private t2phttpClient: HttpClient,
    public spinnerService: SpinnerService
  ) {}
  //Makes the HTTP request and returns the HTTP response for the BPMN model. Triggers the display of the model at the same time.
  public postT2PBPMN(text: string) {
    //Reset Model Container Div, so that only valid/current model will be displayed.
    document.getElementById('model-container')!.innerHTML = '';
    return this.t2phttpClient
      .post<string>(this.urlBPMN, text, httpOptions)
      .subscribe(
        (response: any) => {
          this.spinnerService.hide();

          // Call Method to Display the BPMN Model.
          ModelDisplayer.displayBPMNModel(response);
          this.plainDocumentForDownload = response;
        },
        (error: any) => {
          console.log(error);
          // Error Handling User Feedback
          this.spinnerService.hide();
          document.getElementById('error-container-text')!.innerHTML =
            error.status + ' ' + error.statusText + ' ' + error.error;
          document.getElementById('error-container-text')!.style.display =
            'block';
        }
      );
  }

  //Enables the download of a text file in which the diagram is displayed as a .pnml or .bpmn file. ???
  public downloadModelAsText() {
    const filename = 't2p';
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
  //Makes the HTTP request and returns the HTTP response for the  Petri net. Triggers the display of the model at the same time.
  //The Petri net is displayed in the same way as the BPMN model.
  public postT2PPetriNet(text: string) {
    //Reset Model Container Div, so that only valid/current model will be displayed.
    document.getElementById('model-container')!.innerHTML = '';
    return this.t2phttpClient
      .post<string>(this.urlPetriNet, text, httpOptions)
      .subscribe(
        (response: any) => {
          this.spinnerService.hide();
          // Call Method to Display the BPMN Model.
          ModelDisplayer.generatePetriNet(response);
          this.plainDocumentForDownload = response;
        },
        (error: any) => {
          this.spinnerService.hide();
          // Error Handling User Feedback
          document.getElementById('error-container-text')!.innerHTML =
            error.status + ' ' + error.statusText + ' ' + error.error;
          document.getElementById('error-container-text')!.style.display =
            'block';
        }
      );
  }
  public postT2PWithLLM(
    text: string,
    apiKey: string,
    approach: string,
    callback: (response: any) => void
  ) {
    const llmUrl = 'https://woped.dhbw-karlsruhe.de/t2p-2.0/api_call'; //Specifies the interface through which the BPMN model is displayed.

    const body = {
      text: text,
      api_key: apiKey,
      approach: approach,
    };
    // Reset Model Container Div, so that only valid/current model will be displayed.
    document.getElementById('model-container')!.innerHTML = '';

    return this.t2phttpClient.post<string>(llmUrl, body, httpOptions).subscribe(
      (response: any) => {
        this.spinnerService.hide();
        callback(response); // Call the callback function with the response
      },
      (error: any) => {
        this.spinnerService.hide();
        document.getElementById('error-container-text')!.innerHTML =
          error.status + ' ' + error.statusText + ' ' + error.error;
        document.getElementById('error-container-text')!.style.display =
          'block';
      }
    );
  }
}
