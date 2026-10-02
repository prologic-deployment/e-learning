import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'app-product-details-page',
    templateUrl: './product-details-page.component.html',
    styleUrls: ['./product-details-page.component.scss']
})
export class ProductDetailsPageComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {}

    // Input Counter
	inputnumber = 1;
	plus(){
		this.inputnumber = this.inputnumber+1;
	}
	minus(){(this.inputnumber != 1)
		{
			this.inputnumber = this.inputnumber-1;
		}
	}

}