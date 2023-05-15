import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';

import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';

import {MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule} from '@angular/material/form-field';
import {MatTabsModule} from '@angular/material/tabs';
import {MatStepperModule} from '@angular/material/stepper';
// import {StepperOverviewExample} from './app.stepper';
import {TextFieldModule} from '@angular/cdk/text-field';
import { T2PComponent } from './t2p.component';


 @NgModule({
  declarations: [
    T2PComponent
  ],
  
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatStepperModule,
    TextFieldModule
  
  ],
  providers: [{provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: {appearance: 'outline'}}],

  bootstrap: [T2PComponent]
})
export class T2PModule { }
