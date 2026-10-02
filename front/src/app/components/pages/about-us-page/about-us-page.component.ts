import { Component, OnInit } from '@angular/core';
import { OwlOptions } from 'ngx-owl-carousel-o';

@Component({
    selector: 'app-about-us-page',
    templateUrl: './about-us-page.component.html',
    styleUrls: ['./about-us-page.component.scss']
})
export class AboutUsPageComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {}

	clients = [
  'Tunisie Telecom', 'STEG', 'SONEDE', 'Banque de Tunisie',
  'STB', 'UIB', 'Attijari Bank', 'BIAT',
  'Groupe Poulina', 'SOTUVER', 'Air Tunisie', 'CNSS'
  ];

    aboutSlides: OwlOptions = {
		items: 1,
		nav: true,
		margin: 25,
		loop: true,
		dots: false,
		autoplay: true,
		smartSpeed: 1000,
		autoplayHoverPause: true,
		navText: [
			"<i class='flaticon-left-chevron'></i>",
			"<i class='flaticon-right-arrow-2'></i>"
		]
    }

}