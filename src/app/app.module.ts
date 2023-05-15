import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';

import { RouterModule, Routes } from '@angular/router';
import { T2PComponent } from './t2p/t2p.component';
import { HomeComponent } from './home/home.component';
import { P2tComponent } from './p2t/p2t.component';


const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 't2p', component: T2PComponent },
  // { path: 'p2t', component: P2TComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full'}
];

@NgModule({
  declarations: [
    AppComponent,
    T2PComponent,
    HomeComponent,
    P2tComponent,
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
