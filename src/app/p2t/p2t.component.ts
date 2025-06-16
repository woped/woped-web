import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSlideToggle,MatSlideToggleChange } from '@angular/material/slide-toggle';
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

/**
 * Component for the process-to-text translation UI.
 * Allows users to upload process models, configure API settings, and retrieve translated text.
 */
@Component({
  selector: 'app-p2t',
  templateUrl: './p2t.component.html',
  styleUrls: ['./p2t.component.css'],
})
export class P2tComponent implements OnInit {
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
  useRag: boolean = false;
  providers: string[] = ['openAi', 'gemini', 'lmStudio']; 
  selectedProvider: string = 'openAi'; // Default provider
  prompt = `Create a clearly structured and comprehensible continuous text from the given BPMN that is understandable for an uninformed reader. The text should be easy to read in the summary and contain all important content; if there are subdivided points, these are integrated into the text with suitable sentence beginnings in order to obtain a well-structured and easy-to-read text. Under no circumstances should the output contain sub-items or paragraphs, but should cover all processes in one piece!`;
  isPromptReadonly = true;
  models: string[] = [];
  selectedModel: string;
  error: string;
  hasPromptWarningShown = false; // Flag to track if the warning has been shown
  isApiKeyEntered = false; // New flag to track if API key is entered

  @ViewChild('stepperRef') stepper!: MatStepper;
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('llmToggle') llmToggle!: MatSlideToggle;

  constructor(
    private p2tHttpService: p2tHttpService,
    private t2phttpService: t2pHttpService,
    public spinnerService: SpinnerService
  ) {}

  /**
   * Initializes the component, fetching available GPT models from the backend.
   */
  ngOnInit(): void {
    // Ensure apiKey is set before fetching models
    if (this.apiKey) {
      this.p2tHttpService.getModels(this.apiKey, this.selectedProvider).subscribe(models => {
        this.models = models;
      });
    }
  }

  /**
   * Prevents default drag over behavior.
   * @param event The drag event.
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  /**
   * Handles provider change and fetches appropriate models
   * @param provider The selected provider
  */
  onProviderChange(provider: string): void {
    this.selectedProvider = provider;
    this.models = []; // Clear existing models
    this.selectedModel = ''; // Reset model selection
    
    // LMStudio doesn't need API key
    if (provider === 'lmStudio') {
      this.isApiKeyEntered = true;
      this.fetchModelsForProvider(provider);
    } else {
      // For providers that need API key, only fetch models if key is entered
      this.isApiKeyEntered = !!this.apiKey;
      if (this.isApiKeyEntered) {
        this.fetchModelsForProvider(provider);
      } else {
        this.enterApiKey(); // Prompt for API key if not entered
      }
    }
  }

  /**
   * Fetches models available for the selected provider
   * @param provider The provider to fetch models for
   */
  fetchModelsForProvider(provider: string): void {
    if (provider === 'lmStudio') {
      
      this.p2tHttpService.getModels(null, this.selectedProvider).subscribe(models => {
        this.models = models;
        this.selectedModel = this.models[0];
      });  
    } else if (provider === 'gemini') {
      // Fetch Gemini models via API
      this.p2tHttpService.getModels(this.apiKey, this.selectedProvider).subscribe(models => {
        this.models = models;
        this.selectedModel = models[0];
      });
    } else {
      // Fetch OpenAI models via API
      this.p2tHttpService.getModels(this.apiKey, this.selectedProvider).subscribe(models => {
        this.models = models;
        this.selectedModel = models[0];
      });
    }
  }

  /**
   * Toggles RAG feature on or off
   * @param event The toggle change event
   */
  onRagToggleChange(event: MatSlideToggleChange): void {
    this.useRag = event.checked;
  }

  /**
   * Generates text based on the uploaded process model.
   * Depending on the useLLM flag, it calls the appropriate backend endpoint.
   */
  generateText() {
    if (this.fileType == 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent);
    } else if (this.fileType == 'pnml') {
      ModelDisplayer.generatePetriNet(window.dropfileContent);
    }
    if (window.fileContent !== undefined || window.dropfileContent !== undefined) {
      this.spinnerService.show();
      if (this.useLLM) {
        console.log('Sending LLM request with:', {
          text: window.dropfileContent,
          apiKey: this.apiKey,
          prompt: this.prompt,
          model: this.selectedModel,
          provider: this.selectedProvider
        });
        this.p2tHttpService.postP2TLLM(
          window.dropfileContent, 
          this.apiKey, 
          this.prompt, 
          this.selectedModel,
          this.selectedProvider
        ).subscribe(
          (response: any) => {
            this.spinnerService.hide();
            this.displayText(response);
          },
          (error: any) => {
            this.spinnerService.hide();
            console.error('Error response:', error);
            this.showError(error);
          }
        );
      } else {
        this.p2tHttpService.postP2T(window.dropfileContent).subscribe(
          (response: any) => {
            this.spinnerService.hide();
            this.displayText(response);
          },
          (error: any) => {
            this.spinnerService.hide();
            console.error('Error response:', error);
            this.showError(error);
          }
        );
      }
    } else {
      this.displayText('No files uploaded');
    }
    this.stepper.next();
  }

  /**
   * Handles the toggle change event to switch between Algorithm and LLM modes.
   * @param event The toggle change event.
   */
  onToggleChange(event: MatSlideToggleChange) {
    if (event.checked) {
      this.useLLM = true;
      this.toggleText = 'LLM';
      this.showPromptInput = true;
      this.isApiKeyEntered = false;
      this.selectedProvider = '';
    } else {
      this.useLLM = false;
      this.toggleText = 'Algorithm';
      this.selectedModel = '';
      this.selectedProvider = '';
      this.showPromptInput = false;
      this.isApiKeyEntered = false; // Reset API key flag
    }
  }

  /**
   * Prompts the user to enter their API key and updates the state accordingly.
   * @param event The toggle change event.
   */
  enterApiKey() {
 // If LMStudio is selected, no API key is needed
  if (this.selectedProvider === 'lmStudio') {
    this.useLLM = true;
    this.toggleText = 'LLM';
    this.showPromptInput = true;
    this.isApiKeyEntered = true;
    this.fetchModelsForProvider('lmStudio');
    return;
  }
  
  let apiKey = window.prompt(`Please enter your ${this.selectedProvider} API key`);
  
  // Different validation for different providers
  let isValidKey = false;
  if (this.selectedProvider === 'openAi' && apiKey?.startsWith('sk-proj-')) {
    isValidKey = true;
  } else if (this.selectedProvider === 'gemini' && apiKey?.length > 30) {
    isValidKey = true;
  }
  
  while (apiKey !== null && !isValidKey) {
    window.alert(`Invalid ${this.selectedProvider} API key`);
    apiKey = window.prompt(`Please enter your ${this.selectedProvider} API key again`);
    
    // Recheck validation
    if (this.selectedProvider === 'openAi' && apiKey?.startsWith('sk-proj-')) {
      isValidKey = true;
    } else if (this.selectedProvider === 'gemini' && apiKey?.length > 30) {
      isValidKey = true;
    }
  }
  
  if (apiKey !== null) {
    this.apiKey = apiKey;
    this.useLLM = true;
    this.toggleText = 'LLM';
    this.showPromptInput = true;
    this.isApiKeyEntered = true;
    this.fetchModelsForProvider(this.selectedProvider);
  } else {
    this.useLLM = false;
    this.toggleText = 'Algorithm';
    this.showPromptInput = false;
    this.isApiKeyEntered = false;
    if(this.llmToggle) {
      this.llmToggle.checked = false; // Reset toggle state
    }
  }
}

  /**
   * Prompts the user to enter the API key again.
   */
  promptForApiKey() {
    if (confirm('Would you like to enter the API key again?')) {
      this.enterApiKey();
    }
  }

  /**
   * Returns the last 6 characters of the API key for display purposes.
   * @return The formatted API key string.
   */
  getDisplayApiKey(): string {
    return this.apiKey ? `...${this.apiKey.slice(-6)}` : '';
  }

  /**
   * Enables the prompt text area for editing if the user confirms the warning message.
   */
  editPrompt() {
    if (!this.hasPromptWarningShown) {
      if (confirm('Warning: Changes to the prompt are at your own risk. Would you like to continue?')) {
        this.isPromptReadonly = false;
        this.hasPromptWarningShown = true; // Set the flag to true after the warning is shown
      }
    } else {
      this.isPromptReadonly = false;
    }
  }

  /**
   * Handles the file drop event and processes the dropped files.
   * @param event The drop event.
   */
  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.isFileDropped = true;
      this.droppedFileName = files.item(0)?.name || '';
      this.processDroppedFiles(files);
    }
  }

  /**
   * Processes the dropped files and reads their content.
   * @param files The list of dropped files.
   */
  processDroppedFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        window.dropfileContent = reader.result as string;
        this.fileType = this.getFileType(file.name);
        // Display the model immediately after processing the file
        this.displayModel();
      };
      reader.readAsText(file);
    }
  }

  /**
   * Determines the file type based on the file extension.
   * @param fileName The name of the file.
   * @return The file type ('bpmn' or 'pnml').
   */
  getFileType(fileName: string): string {
    const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
    if (fileExtension === 'pnml') {
      return 'pnml';
    } else if (fileExtension === 'bpmn') {
      return 'bpmn';
    }
    return '';
  }

  /**
   * Initiates the download of the translated text as a .txt file.
   */
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

  /**
   * Opens the file input dialog for selecting files.
   */
  selectFiles() {
    this.fileInputRef.nativeElement.click();
  }

  /**
   * Handles the file selection event and processes the selected files.
   * @param event The file input change event.
   */
  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (files && files.length > 0) {
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;
      this.processDroppedFiles(files);
    }
  }

  /**
   * Displays the appropriate model based on the file type.
   */
  displayModel() {
    if (this.fileType === 'bpmn') {
      ModelDisplayer.displayBPMNModel(window.dropfileContent);
    } else if (this.fileType === 'pnml') {
      ModelDisplayer.generatePetriNet(window.dropfileContent);
    }
  }

  /**
   * Displays the response content in the UI.
   *
   * @param response The response text to be displayed.
   */
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

  /**
   * Displays an error message in the UI.
   *
   * @param errorMessage The error message to be displayed.
   */
  private showError(errorMessage: string) {
    this.error = errorMessage;
  }

  /**
   * Updates the selected model when the dropdown value changes.
   *
   * @param model The selected model.
   */
  onModelChange(model: string): void {
    this.selectedModel = model;
  }

  /**
   * Determines if the "Generate" button should be disabled.
   *
   * @return A boolean indicating if the "Generate" button is disabled.
   */
  isGenerateButtonDisabled(): boolean {
    return false;
  }
}
