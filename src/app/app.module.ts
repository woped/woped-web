import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { p2tHttpService } from './Services/p2tHttpService';
import { t2pHttpService } from './Services/t2pHttpService';
import { AppComponent } from './app.component';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { P2tComponent } from './p2t/p2t.component';
import { T2PComponent } from './t2p/t2p.component';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 't2p', component: T2PComponent },
  { path: 'p2t', component: P2tComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
];

@NgModule({
  declarations: [AppComponent, T2PComponent, HomeComponent, P2tComponent],

  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    MatTabsModule,
    MatStepperModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatGridListModule,
    MatSelectModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [
    {
      provide: { MAT_FORM_FIELD_DEFAULT_OPTIONS },
      multi: true,
      useValue: { appearance: 'outline' },
    },
    p2tHttpService,
    t2pHttpService,
    P2tComponent,
    T2PComponent,
    HomeComponent,
    AppComponent,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
