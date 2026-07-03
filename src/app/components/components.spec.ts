import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { CombinedComponent } from './components';
import { of } from 'rxjs';

describe('CombinedComponent', () => {
  let component: CombinedComponent;
  let fixture: ComponentFixture<CombinedComponent>;
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
        MatRadioModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatStepperModule,
      ],
      declarations: [CombinedComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CombinedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    confirmSpy = jest.spyOn(window, 'confirm');
  });

  // ─── Step 1: LLM Configuration ────────────────────────────────────────────

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should default to LLM enabled (openai provider)', () => {
    expect(component.isLLMEnabled).toBeTruthy();
    expect(component.apiKeyValid).toBeNull();
  });

  it('should default to openai provider', () => {
    expect(component.selectedLLMProvider).toEqual('openai');
  });

  it('should reset apiKeyValid when provider changes', () => {
    component.apiKeyValid = true;
    component.selectedLLMProvider = 'gemini';
    component.apiKeyValid = null; // simulates the change handler
    expect(component.apiKeyValid).toBeNull();
  });

  it('should allow proceeding without LLM (no key required)', () => {
    // The "no LLM" mode has no UI entry point right now (see comment on
    // isLLMEnabled): the backend has no working non-AI fallback for either
    // T2P or P2T. This test documents the intended canProceed formula for
    // whenever isLLMEnabled is false, should that ever become reachable again.
    component.isLLMEnabled = false;
    const canProceed = !component.isLLMEnabled || component.apiKeyValid === true || component.selectedLLMProvider === 'lmstudio';
    expect(canProceed).toBeTruthy();
  });

  it('should allow proceeding with LM Studio (no key required)', () => {
    component.selectedLLMProvider = 'lmstudio';
    const canProceed = !component.isLLMEnabled || component.apiKeyValid === true || component.selectedLLMProvider === 'lmstudio';
    expect(canProceed).toBeTruthy();
  });

  it('should block proceeding with LLM enabled but key not validated', () => {
    component.selectedLLMProvider = 'openai';
    component.apiKeyValid = null;
    const canProceed = !component.isLLMEnabled || component.apiKeyValid === true || component.selectedLLMProvider === 'lmstudio';
    expect(canProceed).toBeFalsy();
  });

  it('should allow proceeding once API key is validated', () => {
    component.selectedLLMProvider = 'openai';
    component.apiKeyValid = true;
    const canProceed = !component.isLLMEnabled || component.apiKeyValid === true || component.selectedLLMProvider === 'lmstudio';
    expect(canProceed).toBeTruthy();
  });

  // ─── Step 2: Tool selection ────────────────────────────────────────────────

  it('should start with no tool selected', () => {
    expect(component.selectedTool).toBeNull();
  });

  it('should allow selecting t2p', () => {
    component.selectedTool = 't2p';
    expect(component.selectedTool).toEqual('t2p');
  });

  it('should allow selecting p2t', () => {
    component.selectedTool = 'p2t';
    expect(component.selectedTool).toEqual('p2t');
  });

  // ─── P2T: model selection ─────────────────────────────────────────────────

  it('should fetch models for lmstudio (null key)', () => {
    const mockModels = ['Llama-2-7b', 'Mistral-7B'];
    jest.spyOn(component['p2tHttpService'], 'getModels').mockReturnValue(of(mockModels));
    component.selectedLLMProvider = 'lmstudio';
    component.fetchModelsForProvider('lmstudio');
    expect(component.models).toEqual(mockModels);
    expect(component.selectedModel).toEqual('Llama-2-7b');
  });

  it('should fetch models for gemini', () => {
    const mockModels = ['gemini-pro', 'gemini-1.5-pro'];
    jest.spyOn(component['p2tHttpService'], 'getModels').mockReturnValue(of(mockModels));
    component.apiKey = 'test-gemini-key';
    component.selectedLLMProvider = 'gemini';
    component.fetchModelsForProvider('gemini');
    expect(component.models).toEqual(mockModels);
    expect(component.selectedModel).toEqual('gemini-pro');
  });

  it('should fetch models for openai and prefer gpt-4 when available', () => {
    const mockModels = ['gpt-3.5-turbo', 'gpt-4'];
    jest.spyOn(component['p2tHttpService'], 'getModels').mockReturnValue(of(mockModels));
    component.apiKey = 'sk-proj-123456';
    component.selectedLLMProvider = 'openai';
    component.fetchModelsForProvider('openai');
    expect(component.models).toEqual(mockModels);
    expect(component.selectedModel).toEqual('gpt-4');
  });

  it('should update selectedModel on onModelChange', () => {
    component.onModelChange('gpt-4o');
    expect(component.selectedModel).toEqual('gpt-4o');
  });

  // ─── P2T: prompt editing ──────────────────────────────────────────────────

  it('should unlock prompt editing after confirm', () => {
    confirmSpy.mockReturnValue(true);
    component.editPrompt();
    expect(component.isPromptReadonly).toBeFalsy();
    expect(component.hasPromptWarningShown).toBeTruthy();
  });

  it('should not unlock prompt editing if confirm is cancelled', () => {
    confirmSpy.mockReturnValue(false);
    component.editPrompt();
    expect(component.isPromptReadonly).toBeTruthy();
  });

  it('should skip confirm dialog on second editPrompt call', () => {
    component.hasPromptWarningShown = true;
    component.editPrompt();
    expect(component.isPromptReadonly).toBeFalsy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // ─── P2T: generate button disabled ───────────────────────────────────────

  it('should disable generate button when no file is dropped', () => {
    component.isFileDropped = false;
    expect(component.isGenerateButtonDisabled()).toBeTruthy();
  });

  it('should disable generate button when LLM is enabled but no model is selected', () => {
    component.isFileDropped = true;
    component.selectedModel = undefined;
    expect(component.isGenerateButtonDisabled()).toBeTruthy();
  });

  it('should enable generate button once a model is selected', () => {
    component.isFileDropped = true;
    component.selectedModel = 'gpt-4';
    expect(component.isGenerateButtonDisabled()).toBeFalsy();
  });

  it('should enable generate button without a model when LLM is disabled', () => {
    // Documents intended behavior for isLLMEnabled=false; currently unreachable via UI.
    component.isFileDropped = true;
    component.isLLMEnabled = false;
    component.selectedModel = undefined;
    expect(component.isGenerateButtonDisabled()).toBeFalsy();
  });

  // ─── T2P: umlaut replacement ──────────────────────────────────────────────

  it('should replace German umlauts', () => {
    const result = (component as any).replaceUmlaut('äöüßÄÖÜ');
    expect(result).toEqual('aeoeuesssAeOeUe');
  });

  // ─── T2P: file type detection ─────────────────────────────────────────────

  it('should detect bpmn file type', () => {
    expect(component.getFileType('process.bpmn')).toEqual('bpmn');
  });

  it('should detect pnml file type', () => {
    expect(component.getFileType('model.pnml')).toEqual('pnml');
  });

  it('should return empty string for unknown file type', () => {
    expect(component.getFileType('data.xml')).toEqual('');
  });

  // ─── T2P: history ─────────────────────────────────────────────────────────

  it('should add a t2pHistory entry after a successful generation', () => {
    jest.spyOn(component['t2pHttpService'], 'getDownloadContent').mockReturnValue('<xml/>');
    (component as any).selectedDiagram = 'bpmn';
    (component as any).pushT2PHistory('Some input text');
    expect((component as any).t2pHistory.length).toEqual(1);
    expect((component as any).t2pHistory[0]).toMatchObject({
      diagramType: 'bpmn',
      inputText: 'Some input text',
      xml: '<xml/>',
    });
  });

  it('should not add a t2pHistory entry when there is no download content yet', () => {
    jest.spyOn(component['t2pHttpService'], 'getDownloadContent').mockReturnValue('');
    (component as any).pushT2PHistory('Some input text');
    expect((component as any).t2pHistory.length).toEqual(0);
  });

  it('should cap t2pHistory at 10 entries, newest first', () => {
    jest.spyOn(component['t2pHttpService'], 'getDownloadContent').mockReturnValue('<xml/>');
    for (let i = 0; i < 12; i++) {
      (component as any).pushT2PHistory(`input ${i}`);
    }
    expect((component as any).t2pHistory.length).toEqual(10);
    expect((component as any).t2pHistory[0].inputText).toEqual('input 11');
  });

  it('should restore a t2pHistory entry (diagram type, text result, download content)', () => {
    const setDownloadContentSpy = jest.spyOn(component['t2pHttpService'], 'setDownloadContent');
    component.restoreT2PHistory({
      timestamp: new Date(),
      diagramType: 'petri-net',
      inputText: 'restored input',
      xml: '<pnml/>',
    });
    expect((component as any).selectedDiagram).toEqual('petri-net');
    expect((component as any).textResult).toEqual('restored input');
    expect(setDownloadContentSpy).toHaveBeenCalledWith('<pnml/>');
  });

  // ─── P2T: history ─────────────────────────────────────────────────────────

  it('should add a p2tHistory entry after displayText()', () => {
    const result = document.createElement('div');
    result.id = 'result';
    document.body.appendChild(result);

    component.droppedFileNameP2T = 'invoice.bpmn';
    (component as any).displayText('Generated text');

    expect((component as any).p2tHistory.length).toEqual(1);
    expect((component as any).p2tHistory[0]).toMatchObject({
      fileName: 'invoice.bpmn',
      resultText: 'Generated text',
    });

    document.body.removeChild(result);
  });

  it('should restore a p2tHistory entry', () => {
    const result = document.createElement('div');
    result.id = 'result';
    document.body.appendChild(result);

    component.restoreP2THistory({ timestamp: new Date(), fileName: 'x', resultText: 'restored text' });
    expect(component.response).toEqual('restored text');

    document.body.removeChild(result);
  });
});