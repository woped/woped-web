import { HttpClient } from '@angular/common/http';
import { Component, OnInit,ViewChild, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { t2pHttpService } from './t2pHttpService';
import { MatStepper } from '@angular/material/stepper';

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
  protected selectedDiagram = 'bpmn';
  protected kindOfDiagram = '';
  protected fileContent = '';
  protected textResult = '';
  @ViewChild('stepperRef') stepper!: MatStepper;
    @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;
    isFiledDropped: boolean= false
    droppedFileName: string = '';
    @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;
    isFileDropped: boolean= false
  constructor(private sanitizer: DomSanitizer, private http: t2pHttpService) {}

  onOpenIFrame(): void {
    this.iFrameURL =
      this.sanitizer.bypassSecurityTrustResourceUrl('https://bpmn.io/');
    this.displayIframe = true;
  }

  // public readUploadedFile(file: File): Promise<string> {
  //   return new Promise<string>((resolve, reject) => {
  //     const reader = new FileReader();

  //      reader.onload = (event: any) => {
  //       const fileContent = event.target.result;
  //       resolve(fileContent);
  //     };

  //     reader.onerror = (event: any) => {
  //       reject(event.target.error);
  //     };

  //  console.log( reader.readAsText(file))  ;
  //   });
  // const file: File = event.target.files[0];
  //   const reader = new FileReader();

  //   reader.onload = (e) => {
  //     this.fileContent = reader.result as string;
  //   };

  //   reader.readAsText(file);
  // }
  // }

  generateProcess(inputText: string) {
    let text = inputText;
    text = this.replaceUmlaut(text);
    if (this.selectedDiagram === 'bpmn') {
      this.http.postt2pBPMN(text);
      this.setTextResult(text);
      this.replaceUmlaut(
        'Der Manager öffnet sein Outlook und überlegt sich ob alles passt'
      );
      console.log('Methode für bpmn wird ausgeführt');
    }
    if (this.selectedDiagram === 'petri-net') {
      this.http.postt2pPetriNet(text);
      this.setTextResult(text);
      console.log('Methode für petri netz wird ausgeführt');
    }
  }
  replaceUmlaut(text: string) {
    return text
      .replace('ä', 'ae')
      .replace('ö', 'oe')
      .replace('ü', 'ue')
      .replace('ß', 'ss')
      .replace('Ä', 'Ae')
      .replace('Ö', 'Oe')
      .replace('Ü', 'Ue');
  }
  onSelectedDiagram(event: any) {
    switch (event.target.value) {
      case 'bpmn':
        this.selectedDiagram = 'bpmn';
        break;
      case 'petri-net':
        this.selectedDiagram = 'petri-net';
    }
  }
  // setTextFromFile(){
  //   this.text = this.readUploadedFile(file);
  // }
  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      // Handle dropped files here
      console.log(files);
    }
    this.processDroppedFiles(files);
    this.isFiledDropped= true;
    this.droppedFileName = files[0].name;

  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }
  processDroppedFiles(files:FileList){
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Handle each dropped file here
        console.log(file.name);

        // Example: Read file content
        const reader = new FileReader();
        reader.onload = (e) => {
          window.dropfileContent = reader.result as string;
          this.setTextInTextBox(window.dropfileContent);
          // Do something with the file content
        };
        reader.readAsText(file);
      }
  }
  setTextInTextBox(text:string){
    this.text = text;
  }
  setTextResult(text:string){
    this.textResult = text;
  }
  
  selectFiles() {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (files && files.length > 0) {
      this.processDroppedFiles(files);
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;
    }
  }
}
