import { Component, ElementRef, ViewChild } from '@angular/core';
import { p2tHttpService } from '../p2tHttpService';
import { MatStepper } from '@angular/material/stepper';
import { HttpResponse } from '@angular/common/http';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { defer, first, fromEvent, merge, mergeMap, switchMap, takeUntil, tap, windowWhen } from 'rxjs';
import { SpinnerService } from './p2t.SpinnerService'

declare global {
  interface Window {
    fileContent: string;
    dropfileContent: string;
  }
}

@Component({
  selector: 'app-p2t',
  templateUrl: './p2t.component.html',
  styleUrls: ['./p2t.component.css'],
  template: `'<p>p2t works!</p>'`
})

export class P2tComponent {
  response: any;
  test: String;
  @ViewChild('stepperRef') stepper!: MatStepper;
  @ViewChild('dropZone', { static: true }) dropZone: ElementRef<HTMLDivElement>;

  isFileDropped: boolean = false
  droppedFileName: string = '';
  @ViewChild('fileInputRef') fileInputRef!: ElementRef<HTMLInputElement>;


  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  constructor(
    private p2tHttpService: p2tHttpService, 
    public spinnerService: SpinnerService
    ) {}

  //   sendText(){
  //     console.log("Ich bin in der Methode")
  //         const input = document.getElementById('fileInput') as HTMLInputElement;
  //         if (input.files && input.files.length > 0) {
  //           const file = input.files[0];
  //           const reader = new FileReader();
  //           reader.onload = (e) => {

  //             window.fileContent = reader.result as string;
  //           };
  //           reader.readAsText(file);
  //         }
  //         event.preventDefault();
  //   }


  generateText() {
    let postmanRequest = `<?xml version="1.0" encoding="UTF-8"?><pnml xmlns="pnml.woped.org">
    <net type="http://www.informatik.hu-berlin.de/top/pntd/ptNetb" id="noID"><place id="p2">
            <name><text>start</text>
                <graphics>
                    <offset x="0" y="0"/>
                </graphics>
            </name>
            <graphics>
                <position x="0" y="0"/>
                <dimension x="40" y="40"/>
            </graphics>
            <initialMarking>
                <text>1</text>
            </initialMarking>
        </place>
        <place id="p3">
            <name>
                <text>end</text>
                <graphics>
                    <offset x="0" y="0"/>
                </graphics>
            </name>
            <graphics>
                <position x="0" y="0"/>
                <dimension x="40" y="40"/>
            </graphics>
        </place>
        <transition id="t2">
            <name>
                <text>buy auto</text>
                <graphics>
                    <offset x="0" y="0"/>
                </graphics>
            </name>
            <graphics>
                <position x="0" y="0"/>
                <dimension x="40" y="40"/>
            </graphics>
            <toolspecific tool="WoPeD" version="1.0">
                <trigger id="" type="200">
                    <graphics>
                        <position x="0" y="0"/>
                        <dimension x="24" y="22"/>
                    </graphics>
                </trigger>
                <transitionResource organizationalUnitName="all" roleName="manager">
                    <graphics>
                        <position x="0" y="0"/>
                        <dimension x="60" y="22"/>
                    </graphics>
                </transitionResource>
                <time>0</time>
                <timeUnit>1</timeUnit>
                <orientation>1</orientation>
            </toolspecific>
        </transition>
        <arc id="a4" source="t2" target="p3">
            <inscription>
                <text>1</text>
                <graphics>
                    <offset x="500.0" y="-12.0"/>
                </graphics>
            </inscription>
            <toolspecific tool="WoPeD" version="1.0">
                <probability>1.0</probability>
                <displayProbabilityOn>false</displayProbabilityOn>
                <displayProbabilityPosition x="500.0" y="12.0"/>
            </toolspecific>
        </arc>
        <arc id="a5" source="p2" target="t2">
            <inscription>
                <text>1</text>
                <graphics>
                    <offset x="500.0" y="-12.0"/>
                </graphics>
            </inscription>
            <toolspecific tool="WoPeD" version="1.0">
                <probability>1.0</probability>
                <displayProbabilityOn>false</displayProbabilityOn>
                <displayProbabilityPosition x="500.0" y="12.0"/>
            </toolspecific>
        </arc>
        <toolspecific tool="WoPeD" version="1.0">
            <bounds>
                <position x="2" y="25"/>
                <dimension x="763" y="574"/>
            </bounds>
            <scale>100</scale>
            <treeWidthRight>549</treeWidthRight>
            <overviewPanelVisible>false</overviewPanelVisible>
            <treeHeightOverview>100</treeHeightOverview>
            <treePanelVisible>false</treePanelVisible>
            <verticalLayout>false</verticalLayout>
            <resources>
                <role Name="manager"/>
                <organizationUnit Name="all"/>
            </resources>
        </toolspecific>
    </net>
</pnml>`;

    if (window.fileContent !== undefined || window.dropfileContent !== undefined) {
      this.spinnerService.show();
    console.log("ich dreh mich");
      this.p2tHttpService.postP2T(window.fileContent);
      this.p2tHttpService.postP2T(window.dropfileContent)
    }

    else {
      this.p2tHttpService.displayText("Keine Datei hochgeladen");
    }
    event.preventDefault();

    console.log("file Content " + window.fileContent);
    this.stepper.next();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const allowedExtensions = ['pnml', 'bpmn'];
      const hasAllowedFiles = Array.from(files).some(file => {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
        return allowedExtensions.includes(fileExtension);
      });

      if (hasAllowedFiles) {
        this.processDroppedFiles(files);
        this.isFileDropped = true;
        this.droppedFileName = files.item(0)?.name || '';
      } else {
        alert('Bitte nur Dateien mit dem Format .pnml oder.bpmn hochladen');
      }
    }
  }





  processDroppedFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        window.dropfileContent = reader.result as string;
        console.log(window.dropfileContent);
      };
      reader.readAsText(file);
    }
  }



  downloadText() {
    let text = this.p2tHttpService.getText();
    let filename = "p2t";
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();
    document.body.removeChild(element);
  }

  selectFiles() {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const files = fileInput.files;
    if (files && files.length > 0) {
      this.processDroppedFiles(files);
      this.isFileDropped = true;
      this.droppedFileName = files[0].name;
    }
  }

}
