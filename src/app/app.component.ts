import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersService, PaginationInfo } from './services/users.service';
import { User } from './models/user.model';
import { UserListComponent } from './components/user-list/user-list.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UserListComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly usersService = inject(UsersService);
  private readonly destroy$ = new Subject<void>();

  // Signals for reactive state management
  users = signal<User[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  pagination = signal<PaginationInfo>({
    page: 1,
    results: 5000,
    hasMore: false,
    loading: false
  });

  ngOnInit(): void {
    // Subscribe to all users
    this.usersService.allUsers$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: users => {
          this.users.set(users);
          this.isLoading.set(false);
          this.error.set(null);
          // Start auto-loading more users after initial success
          this.startAutoLoading();
        },
        error: err => {
          console.error('Error loading users:', err);
          console.error('Error details:', {
            message: err?.message,
            status: err?.status,
            statusText: err?.statusText,
            url: err?.url,
            error: err?.error
          });
          if (err?.status === 429) {
            this.error.set('API rate limit exceeded. The Random User API limits requests for 5000 users. Please wait a moment and try again, or use the "Load More" button to load users in smaller batches.');
          } else {
            this.error.set(`Failed to load users: ${err?.message || err?.statusText || 'Unknown error'}`);
          }
          this.isLoading.set(false);
        }
      });

    // Subscribe to pagination info
    this.usersService.pagination$
      .pipe(takeUntil(this.destroy$))
      .subscribe(pagination => {
        this.pagination.set(pagination);
        // Sync the component loading state with service loading state
        this.isLoading.set(pagination.loading);
        // Set error from pagination if exists
        if (pagination.error) {
          this.error.set(pagination.error);
        }
      });

    // Load initial users
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUsers(): void {
    this.isLoading.set(true);
    this.usersService.resetAndLoad(5000).subscribe({
      next: users => {
        console.log(`✅ AppComponent: Initial load completed - ${users.length} users loaded`);
        // The users are automatically set via the allUsers$ subscription
      },
      error: err => {
        console.error('Error in initial load:', err);
        console.error('Initial load error details:', {
          message: err?.message,
          status: err?.status,
          statusText: err?.statusText,
          url: err?.url,
          error: err?.error
        });
        this.error.set(`Failed to load users: ${err?.message || err?.statusText || 'Unknown error'}`);
        this.isLoading.set(false);
      }
    });
  }

  loadMoreUsers(): void {
    if (this.pagination().hasMore && !this.pagination().loading) {
      this.usersService.loadNextPage(5000).subscribe({
        next: users => {
          console.log(`✅ AppComponent: Load more completed - total ${users.length} users`);
          // The users are automatically set via the allUsers$ subscription
        },
        error: err => {
          console.error('Error loading more users:', err);
          this.error.set('Failed to load more users.');
          this.isLoading.set(false);
        }
      });
    }
  }

  retryLoad(): void {
    this.error.set(null);
    this.loadUsers();
  }

  /**
   * Automatically load additional pages to reach target user count
   * Only auto-loads if the initial 5000-user request fails due to rate limiting
   */
  private autoLoadUsers(targetCount: number = 5000): void {
    const currentCount = this.users().length;
    const pagination = this.pagination();
    
    // Only auto-load if we have fewer users than expected (indicating rate limiting occurred)
    if (currentCount < 1000 && currentCount > 0 && pagination.hasMore && !pagination.loading) {
      setTimeout(() => {
        this.loadMoreUsers();
        // Continue loading with longer delays to respect API limits
        setTimeout(() => this.autoLoadUsers(targetCount), 2000);
      }, 1000);
    }
  }

  /**
   * Start the auto-loading process only if initial load was rate limited
   */
  private startAutoLoading(): void {
    // Only start auto-loading if we got fewer users than requested (indicating rate limiting)
    if (this.users().length < 1000) {
      setTimeout(() => this.autoLoadUsers(5000), 3000);
    }
  }

  /**
   * Get the current year for the footer copyright
   */
  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}
