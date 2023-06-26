import { Component, ElementRef, ViewChild } from '@angular/core';
import { p2tHttpService } from '../p2tHttpService';
import { MatStepper } from '@angular/material/stepper';
import { HttpResponse } from '@angular/common/http';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { defer, first, fromEvent, merge, mergeMap, switchMap, takeUntil, tap, windowWhen } from 'rxjs';
import { SpinnerService } from '../t2p/t2p.SpinnerService';
import { t2pHttpService } from '../t2p/t2pHttpService';

declare global {
  interface Window {
    fileContent: string;
    dropfileContent: string;
  }
}

@Component({
  selector: 'app-p2t',
  templateUrl: './p2t.component.html',
  styleUrls: ['./p2t.component.css'],
  template: `'<p>p2t works!</p>'`
})

export class P2tComponent {
  response: any;
  test: String;
  fileType: String;

  @ViewChild('stepperRef') stepper!: MatStepper;
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;

  isFileDropped: boolean = false
  droppedFileName: string = '';
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  constructor(
    private p2tHttpService: p2tHttpService, 
    private t2phttpService: t2pHttpService,
    public spinnerService: SpinnerService
    ) {}

  generateText() { 
    //Hier geht es zunächst darum, den eingegebenen Text darzustellen
    const paragraph = document.createElement('p');
   // if (file)

  if (this.fileType == "bpmn")
    this.t2phttpService.displayBPMNModel(window.dropfileContent)
  else if (this.fileType == "pnml")
    this.t2phttpService.generatePetriNet(window.dropfileContent)
  //  let input = window.dropfileContent;
  /*  const text = document.createTextNode(input);
    const container = document.getElementById('input');
    if(container.firstChild){
      container.firstChild.remove();
    }
    paragraph.appendChild(text);
    container.appendChild(paragraph);*/

    //Hier wird die Anfrage abgesendet
    
    if (window.fileContent !== undefined || window.dropfileContent !== undefined) {
      this.spinnerService.show();
    //  this.p2tHttpService.postP2T(window.fileContent);
      this.p2tHttpService.postP2T(window.dropfileContent)
    }

    else {
      this.p2tHttpService.displayText("No files uploaded");
    }
    event.preventDefault();

    this.stepper.next();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some(file => {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
        return allowedExtensions.includes(fileExtension);
      });
      if (hasAllowedFiles) {
        console.log("Hallo");

        this.processDroppedFiles(files);
        this.isFileDropped = true;
        this.droppedFileName = files.item(0)?.name || '';
      } else {
        alert('Please upload only files with .pnml or .bpmn format');
      }
    }
  }

  processDroppedFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(file.name);
      const reader = new FileReader();

      reader.onload = (e) => {

        window.dropfileContent = reader.result as string;
      };
      reader.readAsText(file);
    }
  }



  downloadText() {
    let text = this.p2tHttpService.getText();
    let filename = "p2t";
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();
    document.body.removeChild(element);
  }

  selectFiles() {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (files && files.length > 0) {
      this.processDroppedFiles(files);
      console.log("Gakko");
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;

      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some(file => {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
        if (fileExtension == 'pnml')
          this.fileType = "pnml";
        else if(fileExtension == 'bpmn')
          this.fileType = "bpmn";
        return allowedExtensions.includes(fileExtension);
      });
      if (hasAllowedFiles) {
        console.log("Hallo");

        this.processDroppedFiles(files);
        this.isFileDropped = true;
        this.droppedFileName = files.item(0)?.name || '';
      } else {
        alert('Please upload only files with .pnml or .bpmn format');
      }
    }
  }

}
