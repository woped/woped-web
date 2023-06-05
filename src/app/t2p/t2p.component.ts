import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { t2pHttpService } from '../t2pHttpService';

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

  constructor(private sanitizer: DomSanitizer, private http: t2pHttpService) {}

  onOpenIFrame(): void {
    this.iFrameURL =
      this.sanitizer.bypassSecurityTrustResourceUrl('https://bpmn.io/');
    this.displayIframe = true;
  }

  // public readUploadedFile(file: File): Promise<string> {
  //   return new Promise<string>((resolve, reject) => {
  //     const reader = new FileReader();

  //     reader.onload = (event: any) => {
  //       const fileContent = event.target.result;
  //       resolve(fileContent);
  //     };

  //     reader.onerror = (event: any) => {
  //       reject(event.target.error);
  //     };

  //     reader.readAsText(file);
  //   });
  // }

  onCLickButtonToFillOutName() {
    console.log('Eingabe in Textfeld:' + this.text);
  }
  generateProcess(){
    
    console.log("Generate Process")
    const text= `<?xml version="1.0" encoding="UTF-8"?>
    <pnml xmlns="pnml.woped.org">
        <net type="http://www.informatik.hu-berlin.de/top/pntd/ptNetb" id="noID">
            <place id="p2">
                <name>
                    <text>start</text>
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
    </pnml>`

    this.http.postt2p(text)
  }
}
