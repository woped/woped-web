import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { t2pHttpService } from './t2pHttpService';
import { MatStepper } from '@angular/material/stepper';
import { SpinnerService } from './t2p.SpinnerService';

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
  protected radioValue: string = '';
  protected values: string[] = ['BPMN', 'Petri-Net'];
  protected value: string;

  @ViewChild('stepperRef') stepper!: MatStepper;
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;
  isFiledDropped: boolean = false;
  droppedFileName: string = '';
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;
  isFileDropped: boolean = false;
  constructor(
    private sanitizer: DomSanitizer,
    private http: t2pHttpService,
    public spinnerService: SpinnerService
  ) {}

  onOpenIFrame(): void {
    this.iFrameURL =
      this.sanitizer.bypassSecurityTrustResourceUrl('https://bpmn.io/');
    this.displayIframe = true;
  }

  generateProcess(inputText: string) {
    document.getElementById('error-container-text').style.display = 'none';
    this.spinnerService.show();
    let text = inputText;
    text = this.replaceUmlaut(text);
    if (this.selectedDiagram === 'bpmn') {
      this.http.postt2pBPMN(text);
      this.setTextResult(text);
      this.replaceUmlaut(
        'Der Manager öffnet sein Outlook und überlegt sich ob alles passt'
      );
    }
    if (this.selectedDiagram === 'petri-net') {
      this.http.postt2pPetriNet(text);
      this.setTextResult(text);
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
        break;
      default: {
      }
    }
  }
  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;

    if (files && files.length > 0) {
      // Handle dropped files here
    }
    this.processDroppedFiles(files);
    this.isFiledDropped = true;
    this.droppedFileName = files[0].name;
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }
  processDroppedFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Handle each dropped file here

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
  setTextInTextBox(text: string) {
    this.text = text;
  }
  setTextResult(text: string) {
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

  onDownloadText() {
    this.http.downloadModelAsText();
  }
}
