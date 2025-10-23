import { Component, input, signal, computed, OnInit, OnDestroy, DoCheck, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/user.model';
import { UserItemComponent } from '../user-item/user-item.component';
import { UserGroupingService, GroupingCriteria, UserGroup } from '../../services/user-grouping.service';
import { UsersService } from '../../services/users.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-user-list',
  standalone: true,
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    UserItemComponent,
    ScrollingModule,
    FormsModule
  ]
})
export class UserListComponent implements OnInit, OnDestroy, DoCheck {
  private readonly userGroupingService = inject(UserGroupingService);
  private readonly usersService = inject(UsersService);
  private readonly destroy$ = new Subject<void>();

  users = input.required<User[]>();
  
  // Signals for state management
  groupedUsers = signal<UserGroup[]>([]);
  currentGrouping = signal<GroupingCriteria>('alphabetical');
  searchTerm = signal('');
  filteredUsers = signal<User[]>([]);
  isGroupingLoading = signal(false);
  showGrouped = signal(true);
  expandedUser = signal<string | null>(null);

  // Available grouping options
  groupingOptions: { value: GroupingCriteria; label: string; icon: string }[] = [
    { value: 'alphabetical', label: 'Alphabetical', icon: '🔤' },
    { value: 'nationality', label: 'Nationality', icon: '🌍' },
    { value: 'age', label: 'Age Group', icon: '🎂' },
    { value: 'gender', label: 'Gender', icon: '👥' }
  ];

  // Computed properties
  totalUsers = computed(() => this.users().length);
  totalGroups = computed(() => this.groupedUsers().length);
  

  
  // Virtual scrolling configuration
  itemSize = 80;
  
  // Search functionality
  private readonly searchSubject = new Subject<string>();

  ngOnInit(): void {
    // Subscribe to grouping results
    this.userGroupingService.grouping$
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.groupedUsers.set(result.groups);
      });

    // Subscribe to loading state
    this.userGroupingService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isGroupingLoading.set(loading);
      });

    // Set up search with debouncing
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(term => {
        this.searchTerm.set(term);
        this.performSearch(term);
      });

    // Set filteredUsers to the full user list on init
    this.filteredUsers.set(this.users());

    // Initial grouping
    this.groupUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  private performSearch(term: string): void {
    if (!term.trim()) {
      this.filteredUsers.set(this.users());
      this.groupUsers();
      return;
    }

    this.usersService.searchUsers(term)
      .pipe(takeUntil(this.destroy$))
      .subscribe(filtered => {
        this.filteredUsers.set(filtered);
        if (this.showGrouped()) {
          this.userGroupingService.groupUsers(filtered, this.currentGrouping());
        }
      });
  }

  changeGrouping(criteria: GroupingCriteria): void {
    this.currentGrouping.set(criteria);
    this.groupUsers();
  }

  toggleGroupView(): void {
    this.showGrouped.update(show => !show);
  }

  private groupUsers(): void {
    const usersToGroup = this.searchTerm() ? this.filteredUsers() : this.users();
    this.userGroupingService.groupUsers(usersToGroup, this.currentGrouping());
  }

  toggleUserExpansion(userId: string): void {
    this.expandedUser.update(current => current === userId ? null : userId);
  }

  trackByUserId(index: number, user: User): string {
    return user.login?.uuid || `${index}`;
  }

  trackByGroupKey(index: number, group: UserGroup): string {
    return group.key;
  }

  // Virtual scrolling item tracking
  trackByIndex(index: number): number {
    return index;
  }

  getFlatUsersList(): User[] {
    if (!this.showGrouped()) {
      return this.searchTerm() ? this.filteredUsers() : this.users();
    }
    
    return this.groupedUsers().reduce((acc, group) => {
      acc.push(...group.users);
      return acc;
    }, [] as User[]);
  }

  ngDoCheck(): void {
    // Check if users array length has changed
    const currentUsersLength = this.users().length;
    if (currentUsersLength !== this.previousUsersLength) {
      this.previousUsersLength = currentUsersLength;
      // Re-group only if not searching
      if (!this.searchTerm() && currentUsersLength > 0) {
        this.groupUsers();
      }
    }
  }

  /**
   * Public method to refresh grouping when users are updated
   */
  refreshGrouping(): void {
    if (!this.searchTerm()) {
      this.groupUsers();
    }
  }

  private previousUsersLength = 0;
}
