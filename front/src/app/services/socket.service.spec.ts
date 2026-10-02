import { TestBed } from '@angular/core/testing';

import { SocketServiceTsService } from './socket.service';

describe('SocketServiceTsService', () => {
  let service: SocketServiceTsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketServiceTsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
