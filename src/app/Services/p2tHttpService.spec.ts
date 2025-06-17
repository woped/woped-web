import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { p2tHttpService } from './p2tHttpService';

describe('p2tHttpService', () => {
  let service: p2tHttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [p2tHttpService]
    });
    service = TestBed.inject(p2tHttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Make sure that there are no outstanding requests.
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call postP2T with correct parameters', () => {
    const text = 'test text';
    const expectedResponse = 'expected response';

    service.postP2T(text).subscribe(response => {
      expect(response).toEqual(expectedResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}/generateText`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(text);
    expect(req.request.headers.get('Content-Type')).toEqual('text/plain');
    expect(req.request.headers.get('Accept')).toEqual('text/plain');

    req.flush(expectedResponse); // Simulate the response from the server
  });

  it('should call postP2TLLM with correct parameters', () => {
    const text = 'test text';
    const apiKey = 'test key';
    const prompt = 'test prompt';
    const model = 'test model';
    const provider = 'openai';
    const useRag = true;
    const expectedResponse = 'expected response';

    service.postP2TLLM(text, apiKey, prompt, model, provider, useRag).subscribe(response => {
      expect(response).toEqual(expectedResponse);
    });

    const req = httpMock.expectOne(req =>
      req.url === `${service['apiUrl']}/generateTextLLM` &&
      req.params.has('apiKey') &&
      req.params.has('prompt') &&
      req.params.has('gptModel') &&
      req.params.has('provider') &&
      req.params.has('useRag')
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(text);
    expect(req.request.headers.get('Content-Type')).toEqual('text/plain');
    expect(req.request.headers.get('Accept')).toEqual('text/plain');
    expect(req.request.params.get('apiKey')).toEqual(apiKey);
    expect(req.request.params.get('prompt')).toEqual(prompt);
    expect(req.request.params.get('gptModel')).toEqual(model);
    expect(req.request.params.get('provider')).toEqual(provider);
    expect(req.request.params.get('useRag')).toEqual(useRag.toString());

    req.flush(expectedResponse); // Simulate the response from the server
  });

  it('should call getModels with correct parameters', () => {
    const apiKey = 'test key';
    const provider = 'test provider';
    const expectedModels = ['model1', 'model2'];

    service.getModels(apiKey, provider).subscribe(models => {
      expect(models).toEqual(expectedModels);
    });

    const req = httpMock.expectOne(req => req.url === `${service['gptModelsUrl']}` && req.params.get('apiKey') === apiKey && req.params.get('provider') === provider);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('apiKey')).toEqual(apiKey);
    expect(req.request.params.get('provider')).toEqual(provider);

    req.flush(expectedModels); // Simulate the response from the server
  });
});