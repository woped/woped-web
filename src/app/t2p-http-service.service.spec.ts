import { TestBed } from '@angular/core/testing';

import { T2pHttpServiceService } from './t2p-http-service.service';

describe('T2pHttpServiceService', () => {
  let service: T2pHttpServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(T2pHttpServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
