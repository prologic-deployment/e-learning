import { Component } from '@angular/core';
import { COURSE_CATEGORIES } from '../../../shared/categories';

@Component({
    selector: 'app-categories',
    templateUrl: './categories.component.html',
    styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent {
    readonly categories = COURSE_CATEGORIES;
}
