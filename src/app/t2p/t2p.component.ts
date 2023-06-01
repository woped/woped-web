import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-t2p',
  templateUrl: './t2p.component.html',
  styleUrls: ['./t2p.component.css'],
})
export class T2PComponent {
  protected warningText: string = '';
  iFrameURL: SafeResourceUrl;
  displayIframe = false;
  protected text: string = '';
  constructor(private sanitizer: DomSanitizer) {}

  onOpenIFrame(): void {
    this.iFrameURL =
      this.sanitizer.bypassSecurityTrustResourceUrl('https://bpmn.io/');
    this.displayIframe = true;
  }

  public readUploadedFile(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: any) => {
        const fileContent = event.target.result;
        resolve(fileContent);
      };

      reader.onerror = (event: any) => {
        reject(event.target.error);
      };

      reader.readAsText(file);
    });
  }

  onCLickButtonToFillOutName() {
    console.log('Eingabe in Textfeld:' + this.text);
  }
}
