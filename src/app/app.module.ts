import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';

import { RouterModule, Routes } from '@angular/router';
import { T2PComponent } from './t2p/t2p.component';


const routes: Routes = [
  { path: 't2p', component: T2PComponent },
  // { path: 'p2t', component: P2TComponent },
  { path: '', redirectTo: '/t2p', pathMatch: 'full'}
];

@NgModule({
  declarations: [
    AppComponent
  ],
  
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes),
    HttpClientModule,  
  ],

  bootstrap: [AppComponent]
})
export class AppModule { }
