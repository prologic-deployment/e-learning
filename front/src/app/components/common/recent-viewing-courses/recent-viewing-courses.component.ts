import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-recent-viewing-courses',
    templateUrl: './recent-viewing-courses.component.html',
    styleUrls: ['./recent-viewing-courses.component.scss']
})
export class RecentViewingCoursesComponent implements OnInit {

    constructor(
		public router: Router
    ) { }

    ngOnInit(): void {}

}