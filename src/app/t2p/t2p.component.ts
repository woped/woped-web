import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import html2canvas from 'html2canvas';
import { t2pHttpService } from '../Services/t2pHttpService';
import { SpinnerService } from '../utilities/SpinnerService';

@Component({
  selector: 'app-t2p',
  templateUrl: './t2p.component.html',
  styleUrls: ['./t2p.component.css'],
})
export class T2PComponent {
  protected text = '';
  protected selectedDiagram = 'bpmn';
  protected textResult = '';
  protected isLLMEnabled = false;
  protected apiKey = '';
  protected responseText = '';
  protected promptingStrategy = 'few_shot'; // NEW
  protected selectedLLMProvider = 'openai'; // (optional, not used yet)

  @ViewChild('stepperRef') stepper!: MatStepper;
  @ViewChild('dropZone', { static: true }) dropZone!: ElementRef<HTMLDivElement>;
  protected isFiledDropped = false;
  protected droppedFileName = '';
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;
  isFileDropped = false;
  @ViewChild('apiKeyInput') apiKeyInput!: ElementRef;
  @ViewChild('llmSwitch') llmSwitch!: ElementRef;

  constructor(
    private http: t2pHttpService,
    public spinnerService: SpinnerService
  ) {}

  protected generateProcess(inputText: string) {
    document.getElementById('error-container-text')!.style.display = 'none';
    this.spinnerService.show();
    let text = this.replaceUmlaut(inputText);

    if (this.isLLMEnabled) {
      this.apiKey = this.apiKeyInput.nativeElement.value;
      this.http.postT2PWithLLM(
        text,
        this.apiKey,
        this.promptingStrategy,
        (response: any) => {
          this.responseText = JSON.stringify(response, null, 2);
          this.setTextResult(text);
        }
      );
    } else {
      if (this.selectedDiagram === 'bpmn') {
        this.http.postT2PBPMN(text);
        this.setTextResult(text);
      }
      if (this.selectedDiagram === 'petri-net') {
        this.http.postT2PPetriNet(text);
        this.setTextResult(text);
      }
    }
  }

  protected replaceUmlaut(text: string): string {
    return text
      .replace('ä', 'ae')
      .replace('ö', 'oe')
      .replace('ü', 'ue')
      .replace('ß', 'ss')
      .replace('Ä', 'Ae')
      .replace('Ö', 'Oe')
      .replace('Ü', 'Ue');
  }

  protected onSelectedDiagram(event: any) {
    switch (event.target.value) {
      case 'bpmn':
        this.selectedDiagram = 'bpmn';
        break;
      case 'petri-net':
        this.selectedDiagram = 'petri-net';
        break;
    }
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    this.processDroppedFiles(files!);
    this.isFiledDropped = true;
    this.droppedFileName = files![0].name;
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  processDroppedFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        window.dropfileContent = reader.result as string;
        this.setTextInTextBox(window.dropfileContent);
      };
      reader.readAsText(file);
    }
  }

  protected setTextInTextBox(text: string) {
    this.text = text;
  }

  protected setTextResult(text: string) {
    this.textResult = text;
  }

  protected selectFiles() {
    this.fileInputRef.nativeElement.click();
  }

  protected onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (files && files.length > 0) {
      this.processDroppedFiles(files);
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;
    }
  }

  protected onDownloadText() {
    this.http.downloadModelAsText();
  }

  onDownloadImage() {
    const element = document.getElementById('model-container')!;
    html2canvas(element).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = 't2p.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }
}
