import { Injectable } from '@angular/core';
import * as BpmnJS from 'bpmn-js/dist/bpmn-modeler.production.min.js';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';

const httpOptions = {
  headers: new HttpHeaders({
    'Accept': '*/*',
    'Content-Type': 'application/json', // We send Text
  }),
   responseType: 'text' as 'json', // We accept plain text as response.
};

@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  private urlBPMN = 'http://localhost:8081/t2p/generateBPMNv2';
  private urlPetriNet = 'http://localhost:8081/t2p/generatePNML';
  // private urlPetriNet = 'http://localhost:8081/t2p/generatePictureFromPNML';
  public domparser = new DOMParser();


  // private url = 'https://woped.dhbw-karlsruhe.de/t2p/generateText';
  //private text: string;
  constructor(private t2phttpClient: HttpClient) {}
  postt2pBPMN(text: string) {
    return this.t2phttpClient
      .post<string>(this.urlBPMN, text, httpOptions)
      .subscribe(
        (response: any) => {
          console.log(response);
          // Call Method to Display the BPMN Model.
          this.displayBPMNModel(response);
        },
        (error: any) => {
          console.log(error);
        }
      );
  }
  async displayBPMNModel(modelAsBPMN: string) {
    const viewer = new BpmnJS({ container: '#model-container' });
    console.log(viewer)
  try {
    await viewer.importXML(modelAsBPMN);
    // viewer.get('#model-container').zoom('fit-viewport');
  } catch (err) {
    console.error('error loading BPMN 2.0 XML', err);
  }
}
postt2pPetriNet(text:string){
  console.log("postt2pPetriNet");
  return this.t2phttpClient
      .post<string>(this.urlPetriNet, text, httpOptions)
      .subscribe(
        (response: any) => {
          console.log(response);
          // Call Method to Display the BPMN Model.
          this.generatePetriNet(response);
        },
        (error: any) => {
          console.log(error);
        }
      );

}
async generatePetriNet(modelAsPetriNet:string){

  try {
    let xmlDoc = this.domparser.parseFromString(modelAsPetriNet, "text/xml");
    console.log(xmlDoc);
    // let text2 = viewer.importXML(modelAsPetriNet);
    // viewer.peet
    // document.getElementById("model-container").



}
catch(err){
console.log("Error");
}
}
}
