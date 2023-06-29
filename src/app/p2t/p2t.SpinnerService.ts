import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SpinnerService {
  visibility: BehaviorSubject<boolean>;
  //Used to indicate that HTTP request is loading. Appears after step 3 of the mat stepper when the diagram is displayed.
  constructor() {
    this.visibility = new BehaviorSubject(false);
  }
  // Showing the spinner
  show() {
    this.visibility.next(true);
  }

  // Hiding the spinner
   
  hide() {
    this.visibility.next(false);
  }
}