import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-free-courses-single-page',
    templateUrl: './free-courses-single-page.component.html',
    styleUrls: ['./free-courses-single-page.component.scss']
})
export class FreeCoursesSinglePageComponent implements OnInit {

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