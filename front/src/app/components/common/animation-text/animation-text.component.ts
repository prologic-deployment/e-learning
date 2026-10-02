import { Component, OnInit } from '@angular/core';
import { OwlOptions } from 'ngx-owl-carousel-o';

@Component({
    selector: 'app-animation-text',
    templateUrl: './animation-text.component.html',
    styleUrls: ['./animation-text.component.scss']
})
export class AnimationTextComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {}

    textSlides: OwlOptions = {
		items: 1,
		loop: true,
		nav: false,
		dots: false,
		autoplay: true,
		smartSpeed: 1000,
		autoplayHoverPause: true
    }

}