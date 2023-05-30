import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {catchError, retry} from 'rxjs/operators'
import { throwError } from 'rxjs';


const httpOptions= {headers: new HttpHeaders({
  'Content-Type':  'application/json',
  Authorization: 'my-auth-token'
})
};

@Injectable({
  providedIn: 'root'
})
export class p2tHttpService {
  private url= 'https://woped.dhbw-karlsruhe.de/p2t/generateText'

  constructor(private p2thttp: HttpClient) {

   }
   
   postP2T(text: string){
      return this.p2thttp.post<string>(this.url, text, httpOptions)
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
}
