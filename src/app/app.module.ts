import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';

import { RouterModule, Routes } from '@angular/router';
import { T2PComponent } from './t2p/t2p.component';
import { HomeComponent } from './home/home.component';
import { P2tComponent } from './p2t/p2t.component';
import { MatTabsModule } from '@angular/material/tabs';
import { MatStepperModule } from '@angular/material/stepper';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
<<<<<<< Updated upstream
import {MatGridListModule} from '@angular/material/grid-list';
import {MatSelectModule} from '@angular/material/select';
import {MatRadioModule} from '@angular/material/radio';

=======
import { MatGridListModule } from '@angular/material/grid-list';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
>>>>>>> Stashed changes

import { HTTP_INTERCEPTORS } from '@angular/common/http';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 't2p', component: T2PComponent },
  // { path: 'p2t', component: P2TComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
];

@NgModule({
<<<<<<< Updated upstream
  declarations: [
    AppComponent,
    T2PComponent,
    HomeComponent,
    P2tComponent,

  ],
=======
  declarations: [AppComponent, T2PComponent, HomeComponent, P2tComponent],
>>>>>>> Stashed changes

  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    MatTabsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatGridListModule,
    MatSelectModule,
<<<<<<< Updated upstream
    MatRadioModule
=======
    MatRadioModule,
    MatProgressSpinnerModule,
>>>>>>> Stashed changes
  ],
  providers: [
    {
      provide: { MAT_FORM_FIELD_DEFAULT_OPTIONS, HTTP_INTERCEPTORS },
      useClass: CustomHttpInterceptor,
      multi: true,
      useValue: { appearance: 'outline' },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
