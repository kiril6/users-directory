import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-item',
  standalone: true,
  templateUrl: './user-item.component.html',
  styleUrl: './user-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: '0', opacity: 0 }),
        animate('300ms ease-in-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in-out', style({ height: '0', opacity: 0 }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class UserItemComponent {
  user = input.required<User>();
  allUsers = input.required<User[]>();
  expanded = input<boolean>(false);
  
  toggleExpansion = output<void>();

  /**
   * Get the count of users with same nationality
   */
  nationalitiesCount = computed(() => {
    if (!this.allUsers().length) {
      return 0;
    }

    return this.allUsers().reduce((acc, user) => {
      return user.nat === this.user().nat ? acc + 1 : acc;
    }, 0);
  });

  /**
   * Get formatted age display
   */
  ageDisplay = computed(() => {
    const age = this.user().age;
    const dob = this.user().dateOfBirth;
    
    if (age && dob) {
      return `${age} years (${this.formatDate(dob)})`;
    }
    return age ? `${age} years` : 'Unknown';
  });

  /**
   * Get nationality display name
   */
  nationalityDisplay = computed(() => {
    const nat = this.user().nat;
    const nationalities: { [key: string]: string } = {
      'AU': 'Australia',
      'BR': 'Brazil', 
      'CA': 'Canada',
      'CH': 'Switzerland',
      'DE': 'Germany',
      'DK': 'Denmark',
      'ES': 'Spain',
      'FI': 'Finland',
      'FR': 'France',
      'GB': 'United Kingdom',
      'IE': 'Ireland',
      'IN': 'India',
      'IR': 'Iran',
      'MX': 'Mexico',
      'NL': 'Netherlands',
      'NO': 'Norway',
      'NZ': 'New Zealand',
      'RS': 'Serbia',
      'TR': 'Turkey',
      'UA': 'Ukraine',
      'US': 'United States'
    };
    return nat ? nationalities[nat] || nat : 'Unknown';
  });

  /**
   * Get full address
   */
  fullAddress = computed(() => {
    const user = this.user();
    const parts = [
      user.city,
      user.state,
      user.country
    ].filter(Boolean);
    return parts.join(', ');
  });

  onItemClick(): void {
    this.toggleExpansion.emit();
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getGenderIcon(): string {
    const gender = this.user().gender;
    if (gender === 'male') return '👨';
    if (gender === 'female') return '👩';
    return '👤';
  }

  getGenderDisplay(): string {
    const gender = this.user().gender;
    return gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : 'Unknown';
  }
}
