import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { P2tComponent } from './p2t.component';
import { of } from 'rxjs';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

describe('P2tComponent', () => {
  let component: P2tComponent;
  let fixture: ComponentFixture<P2tComponent>;
  let promptSpy: jest.SpyInstance;
  let confirmSpy: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule], 
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
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
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
});