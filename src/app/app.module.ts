import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { TextFieldModule } from '@angular/cdk/text-field';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule, Routes } from '@angular/router';
import { p2tHttpService } from './Services/p2tHttpService';
import { t2pHttpService } from './Services/t2pHttpService';
import { TransformerService } from './Services/transformerService';
import { AppComponent } from './app.component';
import { CombinedComponent } from './components/components';
import { HomeComponent } from './home/home.component';
import { TranslocoRootModule } from './transloco-root.module';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
];

@NgModule({
  declarations: [AppComponent, HomeComponent, CombinedComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes),
    HttpClientModule,
    MatButtonModule,
    MatCheckboxModule,
    MatStepperModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatGridListModule,
    MatSelectModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    TextFieldModule,
    FormsModule,
    ReactiveFormsModule,
    TranslocoRootModule,
  ],
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    p2tHttpService,
    t2pHttpService,
    TransformerService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}