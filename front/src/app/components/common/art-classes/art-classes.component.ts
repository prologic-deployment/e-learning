import { Component, OnInit } from '@angular/core';
import { OwlOptions } from 'ngx-owl-carousel-o';

@Component({
    selector: 'app-art-classes',
    templateUrl: './art-classes.component.html',
    styleUrls: ['./art-classes.component.scss']
})
export class ArtClassesComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {}

    classesSlides: OwlOptions = {
		nav: false,
		margin: 25,
		loop: true,
		dots: true,
		autoplay: true,
		smartSpeed: 1000,
		autoplayHoverPause: true,
		navText: [
			"<i class='bx bx-left-arrow-alt'></i>",
			"<i class='bx bx-right-arrow-alt'></i>"
		],
		responsive: {
			0: {
				items: 1
			},
			515: {
				items: 2
			},
			695: {
				items: 1
			},
			935: {
				items: 1
			},
			1200: {
				items: 2
			}
		}
    }

}