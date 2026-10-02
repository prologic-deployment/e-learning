import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-rtd-banner',
    templateUrl: './rtd-banner.component.html',
    styleUrls: ['./rtd-banner.component.scss']
})
export class RtdBannerComponent implements OnInit {

    constructor(
    ) { }

    ngOnInit(): void {}

    // Video Popup
    isOpen = false;
    openPopup(): void {
        this.isOpen = true;
    }
    closePopup(): void {
        this.isOpen = false;
    }

}