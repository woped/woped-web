import { TestBed } from '@angular/core/testing';
import { t2pHttpService } from './t2pHttpService';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('t2pHttpService', () => {
  let service: t2pHttpService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(t2pHttpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
