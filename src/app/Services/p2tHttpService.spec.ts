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
    const apiKey = 'test key';
    const prompt = 'test prompt';

    service.postP2T(text, apiKey, prompt).subscribe();

    const req = httpMock.expectOne('http://localhost:8080/p2t/generateText?apiKey=test%20key');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(text);
    expect(req.request.headers.get('Content-Type')).toEqual('text/plain');
    expect(req.request.headers.get('Accept')).toEqual('text/plain, */*');
    expect(req.request.params.get('apiKey')).toEqual(apiKey);
  });
});
