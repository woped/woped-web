import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
    // Authorization: 'my-auth-token'
  }),
};

@Injectable({
  providedIn: 'root',
})
export class t2pHttpService {
  // private url= 'localhost:8080/p2t/generateText'
  private url = 'https://woped.dhbw-karlsruhe.de/p2t/generateText';
  private text: string;
  constructor(private t2phttpClient: HttpClient) {}
  postt2p() {
    return this.t2phttpClient
      .post<string>(this.url, this.text, httpOptions)
      .subscribe(
        (response: any) => {
          const body = response.body;
          console.log(body);
        },
        (error: any) => {}
      );
  }
}
