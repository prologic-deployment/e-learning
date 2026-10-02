import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-overview',
    templateUrl: './overview.component.html',
    styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {}

    overviewContent = [
        {
            title: `Industrial business black sheep among white ones`,
            paragraph: `Explore all of our courses and pick your suitable ones to enroll and start learning with us!`,
            paragraph2: `It is expected that the vendor will already be providing their services for the county and that the vendor’s system is being updated with results, prior to performing this process.`,
            buttonText: `Register Now`,
            buttonLink: `/profile-authentication`,
            img: `assets/img/vendor-certification/overview.png`
        }
    ]

}