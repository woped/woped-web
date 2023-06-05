import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {catchError, retry} from 'rxjs/operators'
import { throwError } from 'rxjs';


// const httpOptions= {headers: new HttpHeaders({
//   // 'Content-Type':  'text/plain',
//   // Authorization: 'my-auth-token'
//   // 'Accept-Encoding': 'gzip, deflate, br',
//   // 'Accept': '*/*',
//   // 'Connection': 'keep-alive',
//   // 'User-Agent': 'Mozilla/5.0',
// }
// {responseType: 'text'})};

const httpOptions = {
      headers: new HttpHeaders({
      'Accept': 'text/plain, */*',
      'Content-Type':  'text/plain', // We send Text
      }),
      responseType: 'text' as 'json'  // We accept plain text as response.
    };
@Injectable({
  providedIn: 'root'
})

export class p2tHttpService {
  private url= 'http://localhost:8080/p2t/generateText'
  //private url= 'https://woped.dhbw-karlsruhe.de/p2t/generateText'

  constructor(private http: HttpClient) {


   }
   getDummy(text: string){
     return this.http.get("https://dummyjson.com/products/1").subscribe(data => console.log(data));
   }
   postP2T(text: string){
      return this.http.post<string>(this.url, text, httpOptions).subscribe(data => console.log(data));
      //.pipe(catchError(this.handleError('0')))
      //@felixschempfTODO

   }
   private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error

    }
    // Return an observable with a user-facing error message.
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }

  // getP2t(){
  //   this.p2thttp.get(this.url).
  // }
  // getConfig (resp => {
  //   // display its headers
  //   const keys = resp.headers.keys();
  //   this.headers = keys.map(key =>
  //     ${key}: ${resp.headers.get(key)});

  //   // access the body directly, which is typed as Config.
  //   this.config = { ...resp.body! };
  // })
}

