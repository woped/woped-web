import { TestBed } from '@angular/core/testing';
import { p2tHttpService } from './p2tHttpService';
import { HttpClientTestingModule } from '@angular/common/http/testing';




describe('p2thttpService', () => {
  let service: p2tHttpService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(p2tHttpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
