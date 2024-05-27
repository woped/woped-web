import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatStepper } from '@angular/material/stepper';
import { p2tHttpService } from '../Services/p2tHttpService';
import { t2pHttpService } from '../Services/t2pHttpService';
import { SpinnerService } from '../utilities/SpinnerService';
import { ModelDisplayer } from '../utilities/modelDisplayer';

//global variable to store the file content
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
    template: `'
    <p>p2t works!</p>
    '`,
})
export class P2tComponent {
  response: any;
  test: string;
  fileType: string;

  // ViewChild decorator to get a reference to MatStepper
  @ViewChild('stepperRef') stepper!: MatStepper;
  // ViewChild decorator to get a reference to the drop zone element
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;
  // ViewChild decorator to get a reference to the file input element
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;

   // This method is called when a file is dragged on the drop zone
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }
  
  isFileDropped = false;
  droppedFileName = '';
  toggleText = 'Algorithm';
  apiKey: string;
  apiKeyExample = 'sk-proj-ABcdEFghIJklMNopQRstUVwxYZabCDefghIJklMNopQRstu';

  constructor(
    private p2tHttpService: p2tHttpService,
    private t2phttpService: t2pHttpService,
    public spinnerService: SpinnerService
  ) {}
  /**
  * This method is responsible for generating text from the uploaded file content.
  * It first checks the file type and displays the model accordingly.
  * If there is any content in the file or if any file has been dropped, it shows a spinner,
  * sends a POST request to the p2tHttpService with the dropped file content and the API key,
  * and then clears the API key.
  * If no files have been uploaded, it displays a message saying 'No files uploaded'.
  * It then prevents the default event and moves to the next step in the stepper.
  */
  generateText() {
    const paragraph = document.createElement('p');
    if (this.fileType == 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent);
    } else if (this.fileType == 'pnml') {
      //P2tComponent.displayPNMLModel(window.dropfileContent);
      ModelDisplayer.generatePetriNet(window.dropfileContent);
    }
    if (window.fileContent !== undefined || window.dropfileContent !== undefined) {
      this.spinnerService.show();
      this.p2tHttpService.postP2T(window.dropfileContent, this.apiKey);
      this.clearApiKey();
    } else {
      this.p2tHttpService.displayText('No files uploaded');
    }
    event.preventDefault();
    this.stepper.next();
  }
  /**
 * This method is called when the toggle switch state is changed.
 * If the toggle is switched on, it prompts the user to enter their API key.
 * It checks if the entered API key is valid (i.e., it has the same length as `apiKeyExample` and starts with 'sk-proj-').
 * If the API key is valid, it is stored and the toggle's text is set to 'LLM'.
 * If the API key is invalid, it prompts the user to enter their API key again.
 * If the toggle is switched off, the toggle's text is set to 'Algorithm'.
 */
  onToggleChange(event: MatSlideToggleChange) {
    if (event.checked) {
      let apiKey = window.prompt('Please enter your API key');
      while (apiKey !== null && (apiKey.length !== this.apiKeyExample.length || !apiKey.startsWith('sk-proj-'))) {
        window.alert('Invalid API key');
        apiKey = window.prompt('Please enter your API key');
      }
      if (apiKey !== null) {
        this.apiKey = apiKey;
        this.toggleText = 'LLM';
      } else {
        event.source.checked = false;
        this.toggleText = 'Algorithm';
      }
    } else {
      this.toggleText = 'Algorithm';
    }
    console.log('Toggle changed to: ', event.checked);
  }

  /**
 * This method is called when a file is dropped into the drop zone.
 * It prevents the default event behavior and retrieves the dropped files.
 * If there are any files and at least one of them has an allowed extension ('pnml' or 'bpmn'),
 * it processes the file(s) accordingly.
 */
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

  /**
 * This method is called to process the files that have been dropped into the drop zone.
 * It iterates over each file in the FileList.
 * For each file, it creates a new FileReader and sets its onload function to store the file's content in `window.dropfileContent`.
 * It then reads the file as text.
 */
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
    const text = this.p2tHttpService.getText();
    const filename = 'p2t';
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

  /**
 * This method is called when a file is selected from the file input.
 * It retrieves the selected files and checks if there are any.
 * If there are files and at least one of them has an allowed extension ('pnml' or 'bpmn'),
 * it processes the file(s) accordingly, sets `isFileDropped` to true, and stores the name of the first file in `droppedFileName`.
 * It also sets `fileType` to the extension of the file if it is either 'pnml' or 'bpmn'.
 */
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
}
