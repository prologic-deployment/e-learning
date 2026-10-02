import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-partner',
    templateUrl: './partner.component.html',
    styleUrls: ['./partner.component.scss']
})
export class PartnerComponent implements OnInit {

    constructor(
		public router: Router
    ) { }

    ngOnInit(): void {}

    partnerList = [
        {
            img: `assets/img/kitchen-coach/partner/partner1.png`,
            link: `#`
        },
        {
            img: `assets/img/kitchen-coach/partner/partner2.png`,
            link: `#`
        },
        {
            img: `assets/img/kitchen-coach/partner/partner3.png`,
            link: `#`
        },
        {
            img: `assets/img/kitchen-coach/partner/partner4.png`,
            link: `#`
        },
        {
            img: `assets/img/kitchen-coach/partner/partner5.png`,
            link: `#`
        },
        {
            img: `assets/img/kitchen-coach/partner/partner6.png`,
            link: `#`
        }
    ]

}