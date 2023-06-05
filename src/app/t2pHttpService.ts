import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';

const httpOptions = {
  headers: new HttpHeaders({
    Accept: 'text/plain, */*',
    'Content-Type': 'text/plain', // We send Text
  }),
  responseType: 'text' as 'json', // We accept plain text as response.
};

@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  private url = 'http://localhost:8080/p2t/generateText';
  // private url = 'https://woped.dhbw-karlsruhe.de/t2p/generateText';
  //private text: string;
  constructor(private t2phttpClient: HttpClient) {}
  postt2p(text: string) {
    return this.t2phttpClient
      .post<string>(this.url, text, httpOptions)
      .subscribe(
        (response: any) => {
          const body = response.body;
          console.log(body);
        },
        (error: any) => {
          console.log(error);
        }
      );
  }
}
