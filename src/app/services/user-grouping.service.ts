import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { User } from '../models/user.model';

export interface UserGroup {
  key: string;
  label: string;
  users: User[];
  count: number;
}

export type GroupingCriteria = 'alphabetical' | 'nationality' | 'age' | 'gender';

export interface GroupingMessage {
  users: User[];
  groupBy: GroupingCriteria;
}

export interface GroupingResult {
  groups: UserGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class UserGroupingService implements OnDestroy {
  private worker?: Worker;
  private readonly groupingSubject = new Subject<GroupingResult>();
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  public grouping$ = this.groupingSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../workers/user-grouping.worker.ts', import.meta.url));
      
      this.worker.onmessage = ({ data }: MessageEvent<GroupingResult>) => {
        // Convert plain objects back to User instances
        const result: GroupingResult = {
          groups: data.groups.map(group => ({
            ...group,
            users: group.users.map(userData => new User(userData))
          }))
        };
        this.groupingSubject.next(result);
        this.loadingSubject.next(false);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        this.loadingSubject.next(false);
      };
    }
  }

  groupUsers(users: User[], groupBy: GroupingCriteria): void {
    if (!this.worker) {
      // Fallback for environments without Worker support
      this.fallbackGrouping(users, groupBy);
      return;
    }

    this.loadingSubject.next(true);
    
    const message: GroupingMessage = { users, groupBy };
    this.worker.postMessage(message);
  }

  private fallbackGrouping(users: User[], groupBy: GroupingCriteria): void {
    this.loadingSubject.next(true);
    
    // Simple synchronous grouping as fallback
    setTimeout(() => {
      const groups = this.performSyncGrouping(users, groupBy);
      this.groupingSubject.next({ groups });
      this.loadingSubject.next(false);
    }, 0);
  }

  private performSyncGrouping(users: User[], groupBy: GroupingCriteria): UserGroup[] {
    const groups = new Map<string, User[]>();

    for (const user of users) {
      let key: string;

      switch (groupBy) {
        case 'alphabetical': {
          key = user.firstname ? user.firstname.charAt(0).toUpperCase() : 'Unknown';
          break;
        }
        case 'nationality': {
          key = user.nat || 'Unknown';
          break;
        }
        case 'age': {
          const ageGroup = this.getAgeGroup(user.age || 0);
          key = ageGroup.key;
          break;
        }
        case 'gender': {
          key = user.gender || 'Unknown';
          break;
        }
        default: {
          key = 'All';
        }
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(user);
    }

    return Array.from(groups.entries())
      .map(([key, groupUsers]) => {
        const sortedUsers = [...groupUsers].sort((a, b) => 
          (a.firstname || '').localeCompare(b.firstname || '')
        );
        
        let label: string;
        if (key === 'Unknown') {
          label = 'Unknown';
        } else if (groupBy === 'nationality') {
          label = this.getNationalityName(key);
        } else if (groupBy === 'age') {
          const ageGroup = this.getAgeGroup(Number.parseInt(key.split('-')[0]) || 0);
          label = ageGroup.label;
        } else if (groupBy === 'gender') {
          label = key.charAt(0).toUpperCase() + key.slice(1);
        } else {
          label = key;
        }

        return {
          key,
          label,
          users: sortedUsers,
          count: groupUsers.length
        };
      })
      .sort((a, b) => {
        if (a.key === 'Unknown') return 1;
        if (b.key === 'Unknown') return -1;
        return a.key.localeCompare(b.key);
      });
  }

  private getAgeGroup(age: number): { key: string; label: string } {
    if (age < 18) return { key: '0-17', label: 'Under 18' };
    if (age < 25) return { key: '18-24', label: '18-24 years' };
    if (age < 35) return { key: '25-34', label: '25-34 years' };
    if (age < 45) return { key: '35-44', label: '35-44 years' };
    if (age < 55) return { key: '45-54', label: '45-54 years' };
    if (age < 65) return { key: '55-64', label: '55-64 years' };
    return { key: '65+', label: '65+ years' };
  }

  private getNationalityName(code: string): string {
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
    return nationalities[code] || code;
  }

  ngOnDestroy(): void {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}