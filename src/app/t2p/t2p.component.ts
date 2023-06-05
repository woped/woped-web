import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { t2pHttpService } from '../t2pHttpService';

@Component({
  selector: 'app-t2p',
  templateUrl: './t2p.component.html',
  styleUrls: ['./t2p.component.css'],
})
export class T2PComponent {
  protected warningText: string = '';
  iFrameURL: SafeResourceUrl;
  displayIframe = false;
  protected text: string = '';
  protected selectedDiagram = '';

  constructor(private sanitizer: DomSanitizer, private http: t2pHttpService) {}

  onOpenIFrame(): void {
    this.iFrameURL =
      this.sanitizer.bypassSecurityTrustResourceUrl('https://bpmn.io/');
    this.displayIframe = true;
  }

  // public readUploadedFile(file: File): Promise<string> {
  //   return new Promise<string>((resolve, reject) => {
  //     const reader = new FileReader();

  //     reader.onload = (event: any) => {
  //       const fileContent = event.target.result;
  //       resolve(fileContent);
  //     };

  //     reader.onerror = (event: any) => {
  //       reject(event.target.error);
  //     };

  //     reader.readAsText(file);
  //   });
  // }

  onCLickButtonToFillOutName() {
    console.log('Eingabe in Textfeld:' + this.text);
  }
  generateProcess(inputText:string){
    let text = inputText;
    text = this.replaceUmlaut(text);
    if(this.selectedDiagram="bpmn"){
    this.http.postt2pBPMN(text);
    this.replaceUmlaut("Der Manager öffnet sein Outlook und überlegt sich ob alles passt");
    console.log("Methode für bpmn wird ausgeführt")}
    if(this.selectedDiagram = "petri-net")
    {this.http.postt2pPetriNet(text)
    console.log("Methode für petri netz wird ausgeführt")
    }

  }
   replaceUmlaut(text :string){

    return text.replace("ä","ae").replace("ö","oe").replace("ü","ue").replace("ß","ss").replace("Ä","Ae").replace("Ö","Oe").replace("Ü","Ue");

  }
  onSelectedDiagram(value:string){
    this.selectedDiagram = value;
  }
}
