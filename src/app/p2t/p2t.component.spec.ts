import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { P2tComponent } from './p2t.component';
import { of } from 'rxjs';

describe('P2tComponent', () => {
  let component: P2tComponent;
  let fixture: ComponentFixture<P2tComponent>;
  let promptSpy: jest.SpyInstance;
  let confirmSpy: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        FormsModule,
        BrowserAnimationsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatStepperModule
      ], 
      declarations: [ P2tComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(P2tComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Create spies for global functions
    promptSpy = jest.spyOn(window, 'prompt');
    confirmSpy = jest.spyOn(window, 'confirm');
  });

  it('should enter API key', () => {
    promptSpy.mockReturnValue('sk-proj-123456');
    component.enterApiKey();
    expect(component.apiKey).toEqual('sk-proj-123456');
    expect(component.useLLM).toBeTruthy();
    expect(component.toggleText).toEqual('LLM');
    expect(component.showPromptInput).toBeTruthy();
  });

  it('should prompt for API key', () => {
    confirmSpy.mockReturnValue(true);
    promptSpy.mockReturnValue('sk-proj-123456');
    component.promptForApiKey();
    expect(component.apiKey).toEqual('sk-proj-123456');
  });

  it('should get display API key', () => {
    component.apiKey = 'sk-proj-123456';
    expect(component.getDisplayApiKey()).toEqual('...123456');
  });

  it('should edit prompt', () => {
    confirmSpy.mockReturnValue(true);
    component.editPrompt();
    expect(component.isPromptReadonly).toBeFalsy();
  });

  
  it('should set provider to lmStudio and fetch models', () => {
    const fetchModelsSpy = jest.spyOn(component, 'fetchModelsForProvider');
    component.onProviderChange('lmStudio');
    expect(component.selectedProvider).toEqual('lmStudio');
    expect(component.isApiKeyEntered).toBeTruthy();
    expect(fetchModelsSpy).toHaveBeenCalledWith('lmStudio');
  });

  it('should set provider to openAi and prompt for API key', () => {
    const enterApiKeySpy = jest.spyOn(component, 'enterApiKey');
    component.onProviderChange('openAi');
    expect(component.selectedProvider).toEqual('openAi');
    expect(enterApiKeySpy).toHaveBeenCalled();
  });

  it('should fetch lmStudio models via service', () => {
    const mockModels = ['Llama-2-7b', 'Mistral-7B'];
    jest.spyOn(component['p2tHttpService'], 'getModels').mockReturnValue(of(mockModels));
    component.selectedProvider = 'lmStudio';
    component.fetchModelsForProvider('lmStudio');
    expect(component.models).toEqual(mockModels);
    expect(component.selectedModel).toEqual('Llama-2-7b');
  });

  it('should fetch gemini models via service', () => {
    const mockModels = ['gemini-pro', 'gemini-1.5-pro'];
    jest.spyOn(component['p2tHttpService'], 'getModels').mockReturnValue(of(mockModels));
    component.apiKey = 'test-gemini-key';
    component.selectedProvider = 'gemini';
    component.fetchModelsForProvider('gemini');
    expect(component.models).toEqual(mockModels);
    expect(component.selectedModel).toEqual('gemini-pro');
  });

  it('should fetch openAi models via service', () => {
    const mockModels = ['gpt-3.5-turbo', 'gpt-4'];
    jest.spyOn(component['p2tHttpService'], 'getModels').mockReturnValue(of(mockModels));
    component.apiKey = 'sk-proj-123456';
    component.selectedProvider = 'openAi';
    component.fetchModelsForProvider('openAi');
    expect(component.models).toEqual(mockModels);
    expect(component.selectedModel).toEqual('gpt-3.5-turbo');
  });

  it('should enable LLM mode when toggled on', () => {
    const mockEvent = { checked: true } as MatSlideToggleChange;
    component.onToggleChange(mockEvent);
    expect(component.useLLM).toBeTruthy();
    expect(component.toggleText).toEqual('LLM');
    expect(component.showPromptInput).toBeTruthy();
    expect(component.selectedProvider).toEqual('');
  });

  it('should enable RAG when toggled on', () => {
    const mockEvent = { checked: true } as MatSlideToggleChange;
    component.onRagToggleChange(mockEvent);
    expect(component.useRag).toBeTruthy();
  });

  it('should disable RAG when toggled off', () => {
    const mockEvent = { checked: false } as MatSlideToggleChange;
    component.onRagToggleChange(mockEvent);
    expect(component.useRag).toBeFalsy();
  });
});