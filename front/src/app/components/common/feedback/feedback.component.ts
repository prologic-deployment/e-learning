import { Component, OnInit } from '@angular/core';
import { OwlOptions } from 'ngx-owl-carousel-o';
import { Router } from '@angular/router';

@Component({
    selector: 'app-feedback',
    templateUrl: './feedback.component.html',
    styleUrls: ['./feedback.component.scss']
})
export class FeedbackComponent implements OnInit {

    constructor(
		public router: Router
    ) { }

    feedbackContent = [
        {
            sectionTitle: `Learners say about Edla`,
            paragraph: `Explore all of our courses and pick your suitable ones to enroll and start learning with us!`,
            feedback: [
                {
                    text: `Lorem ipsum dolor sit amet, consectetur elit, sed do eiusmod tempor incididunt ut labore et mag na aliqua. Minim veniam, quis nostrud ullamco laboris nisi ut aliquip ex ea commodo conse quatt adipiscing dolore.`,
					img: `assets/img/user/user1.jpg`,
					name: `Jasica Lora`,
					designation: `TV Model`
                },
                {
                    text: `Lorem ipsum dolor sit amet, consectetur elit, sed do eiusmod tempor incididunt ut labore et mag na aliqua. Minim veniam, quis nostrud ullamco laboris nisi ut aliquip ex ea commodo conse quatt adipiscing dolore.`,
					img: `assets/img/user/user2.jpg`,
					name: `Allien Zampa`,
					designation: `Developer`
                },
                {
                    text: `Lorem ipsum dolor sit amet, consectetur elit, sed do eiusmod tempor incididunt ut labore et mag na aliqua. Minim veniam, quis nostrud ullamco laboris nisi ut aliquip ex ea commodo conse quatt adipiscing dolore.`,
					img: `assets/img/user/user3.jpg`,
					name: `Ramos Leo`,
					designation: `Designer`
                },
                {
                    text: `Lorem ipsum dolor sit amet, consectetur elit, sed do eiusmod tempor incididunt ut labore et mag na aliqua. Minim veniam, quis nostrud ullamco laboris nisi ut aliquip ex ea commodo conse quatt adipiscing dolore.`,
					img: `assets/img/user/user4.jpg`,
					name: `Cris Hakimi`,
					designation: `Business Man`
                }
            ]
        }
    ]

    ngOnInit(): void {}

    feedbackSlides: OwlOptions = {
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
		],
		responsive: {
			0: {
				items: 1
			},
			515: {
				items: 1
			},
			695: {
				items: 2
			},
			935: {
				items: 3
			},
			1200: {
				items: 3
			}
		}
    }
    feedbackWithDotsSlides: OwlOptions = {
		nav: false,
		margin: 25,
		loop: true,
		dots: true,
		autoplay: true,
		smartSpeed: 1000,
		autoplayHoverPause: true,
		navText: [
			"<i class='flaticon-left-chevron'></i>",
			"<i class='flaticon-right-arrow-2'></i>"
		],
		responsive: {
			0: {
				items: 1
			},
			515: {
				items: 1
			},
			695: {
				items: 2
			},
			935: {
				items: 3
			},
			1200: {
				items: 3
			}
		}
    }
    rtfeedbackSlides: OwlOptions = {
		items: 1,
		nav: true,
		margin: 25,
		loop: true,
		dots: true,
		autoplay: true,
		smartSpeed: 1000,
		autoplayHoverPause: true,
		navText: [
			"<i class='bx bx-left-arrow-alt'></i>",
			"<i class='bx bx-right-arrow-alt'></i>"
		]
    }

}