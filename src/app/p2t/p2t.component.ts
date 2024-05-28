import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatStepper } from '@angular/material/stepper';
import { p2tHttpService } from '../Services/p2tHttpService';
import { t2pHttpService } from '../Services/t2pHttpService';
import { SpinnerService } from '../utilities/SpinnerService';
import { ModelDisplayer } from '../utilities/modelDisplayer';

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
})
export class P2tComponent {
  response: any;
  test: string;
  fileType: string;
  isFileDropped = false;
  droppedFileName = '';
  toggleText = 'Algorithm';
  apiKey: string;
  apiKeyExample = 'sk-proj-ABcdEFghIJklMNopQRstUVwxYZabCDefghIJklMNopQRstu';
  showPromptInput = false;
  useLLM = false;
  prompt = `Create a clearly structured and comprehensible continuous text from the given BPMN that is understandable for an uninformed reader. The text should be easy to read in the summary and contain all important content; if there are subdivided points, these are integrated into the text with suitable sentence beginnings in order to obtain a well-structured and easy-to-read text. Under no circumstances should the output contain sub-items or paragraphs, but should cover all processes in one piece!`;
  isPromptReadonly = true;

  @ViewChild('stepperRef') stepper!: MatStepper;
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    private p2tHttpService: p2tHttpService,
    private t2phttpService: t2pHttpService,
    public spinnerService: SpinnerService
  ) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  generateText() {
    if (this.fileType == 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent);
    } else if (this.fileType == 'pnml') {
      ModelDisplayer.generatePetriNet(window.dropfileContent);
    }
    if (window.fileContent !== undefined || window.dropfileContent !== undefined) {
      this.spinnerService.show();
      if (this.useLLM) {
        this.p2tHttpService.postP2T(window.dropfileContent, this.apiKey, this.prompt).subscribe(
          (response: any) => {
            this.spinnerService.hide();
            this.displayText(response);
          },
          (error: any) => {
            this.spinnerService.hide();
            this.showError(this.p2tHttpService.handleError(error).toString());
          }
        );
      } else {
        this.p2tHttpService.postP2T(window.dropfileContent, '', this.prompt).subscribe(
          (response: any) => {
            this.spinnerService.hide();
            this.displayText(response);
          },
          (error: any) => {
            this.spinnerService.hide();
            this.showError(this.p2tHttpService.handleError(error).toString());
          }
        );
      }
    } else {
      this.displayText('No files uploaded');
    }
    event?.preventDefault();
    this.stepper.next();
  }

  onToggleChange(event: MatSlideToggleChange) {
    if (event.checked) {
      this.enterApiKey(event);
    } else {
      this.useLLM = false;
      this.toggleText = 'Algorithm';
      this.showPromptInput = false;
    }
    console.log('Toggle changed to: ', event.checked);
  }

  enterApiKey(event: MatSlideToggleChange) {
    let apiKey = window.prompt('Please enter your API key');
    while (apiKey !== null && (apiKey.length !== this.apiKeyExample.length || !apiKey.startsWith('sk-proj-'))) {
      window.alert('Invalid API key');
      apiKey = window.prompt('Please enter your API key');
    }
    if (apiKey !== null) {
      this.apiKey = apiKey;
      this.useLLM = true;
      this.toggleText = 'LLM';
      this.showPromptInput = true;
    } else {
      this.useLLM = false;
      this.toggleText = 'Algorithm';
      this.showPromptInput = false;
      event.source.checked = false;
    }
  }

  promptForApiKey() {
    if (confirm('Möchten Sie den API-Schlüssel erneut eingeben?')) {
      this.enterApiKey(null);
    }
  }

  getDisplayApiKey(): string {
    return this.apiKey ? `...${this.apiKey.slice(-6)}` : '';
  }

  checkConditions() {
    // Zusätzliche Logik zur Bedingungsprüfung (falls erforderlich)
  }

  editPrompt() {
    if (confirm('Warnung: Änderungen am Prompt erfolgen auf eigene Gefahr. Möchten Sie fortfahren?')) {
      this.isPromptReadonly = false;
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some((file) => {
        const fileExtension = file.name
          .substring(file.name.lastIndexOf('.') + 1)
          .toLowerCase();
        return allowedExtensions.includes(fileExtension);
      });
      if (hasAllowedFiles) {
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
      const reader = new FileReader();
      reader.onload = (e) => {
        window.dropfileContent = reader.result as string;
      };
      reader.readAsText(file);
    }
  }

  downloadText() {
    const text = this.response;
    const filename = 'p2t.txt';
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    );
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
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;
      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some((file) => {
        const fileExtension = file.name
          .substring(file.name.lastIndexOf('.') + 1)
          .toLowerCase();
        if (fileExtension == 'pnml') this.fileType = 'pnml';
        else if (fileExtension == 'bpmn') this.fileType = 'bpmn';
        return allowedExtensions.includes(fileExtension);
      });
      if (hasAllowedFiles) {
        this.processDroppedFiles(files);
        this.isFileDropped = true;
        this.droppedFileName = files.item(0)?.name || '';
      } else {
        alert('Please upload only files with .pnml or .bpmn format');
      }
    }
  }

  private clearApiKey() {
    this.apiKey = '';
  }

  private displayText(response: string) {
    this.response = this.p2tHttpService.formText(response);
    const container = document.getElementById('result')!;
    const paragraph = document.createElement('p');
    paragraph.textContent = this.response;
    if (container.firstChild) {
      container.firstChild.remove();
    }
    container.appendChild(paragraph);
  }

  private showError(errorMessage: string) {
    const errorBox = document.getElementById('error-box')!;
    const errorContent = document.getElementById('error-content')!;
    errorBox.style.visibility = 'visible';
    errorContent.innerHTML = errorMessage;
    errorContent.style.display = 'block';
  }
}
