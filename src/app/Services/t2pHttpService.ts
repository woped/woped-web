import { Injectable } from '@angular/core';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SpinnerService } from '../utilities/SpinnerService';

import { ModelDisplayer } from '../utilities/modelDisplayer';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  }),
  responseType: 'text' as 'json', // API returns text, not JSON
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
    public spinnerService: SpinnerService
  ) { }
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
    modelType: string, // New parameter to specify BPMN or Petri Net
    llmProvider: string, // Dynamic LLM provider from frontend
    callback: (response: any) => void
  ) {
    // Determine the appropriate URL based on the modelType
    let llmUrl: string;
    console.log('Approach value:', approach);
    console.log('Model type:', modelType);

    if (modelType.toLowerCase().includes('bpmn') || modelType === 'bpmn') {
      llmUrl = this.urlBPMN;
      console.log('Using BPMN URL:', llmUrl);
    } else if (modelType.toLowerCase().includes('petri') || modelType.toLowerCase().includes('pnml') || modelType === 'petri') {
      llmUrl = this.urlPetriNet;
      console.log('Using Petri Net URL:', llmUrl);
    } else {
      console.error('Unknown model type:', modelType);
      this.spinnerService.hide();
      document.getElementById('error-container-text')!.innerHTML = 'Unknown model type: ' + modelType;
      document.getElementById('error-container-text')!.style.display = 'block';
      return;
    }

    const body = {
      text: text,
      api_key: apiKey,
      approach: approach,
      llm_provider: llmProvider // Use the dynamic llm_provider from frontend
    };
    // Reset Model Container Div, so that only valid/current model will be displayed.
    document.getElementById('model-container')!.innerHTML = '';

    return this.t2phttpClient.post<string>(llmUrl, body, httpOptions).subscribe(
      (response: any) => {
        this.spinnerService.hide();

        // Parse the JSON response since API returns JSON as text
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(response);
        } catch (e) {
          // If parsing fails, treat response as plain text
          parsedResponse = { result: response };
        }

        // Extract the result from the parsed JSON response
        const xmlContent = parsedResponse.result || parsedResponse;
        this.plainDocumentForDownload = xmlContent;

        // Determine which display method to use based on modelType
        if (modelType.toLowerCase().includes('bpmn') || modelType === 'bpmn') {
          ModelDisplayer.displayBPMNModel(xmlContent);
        } else if (modelType.toLowerCase().includes('petri') || modelType.toLowerCase().includes('pnml') || modelType === 'petri') {
          ModelDisplayer.generatePetriNet(xmlContent);
        }

        callback(parsedResponse); // Call the callback function with the parsed response
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
