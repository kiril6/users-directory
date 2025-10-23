import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { ApiResult } from '../models/api-result.model';

export interface PaginationInfo {
  page: number;
  results: number;
  hasMore: boolean;
  loading: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly baseUrl = 'https://randomuser.me/api/';
  private readonly allUsersSubject = new BehaviorSubject<User[]>([]);
  private readonly paginationSubject = new BehaviorSubject<PaginationInfo>({
    page: 1,
    results: 5000, // Default page size as required
    hasMore: true,
    loading: false
  });

  // Public observables
  allUsers$ = this.allUsersSubject.asObservable();
  pagination$ = this.paginationSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  /**
   * Get users with pagination support
   * Uses 5000 as default page size per requirement, with smart fallback for API rate limiting
   */
  getUsers(page = 1, results = 5000): Observable<ApiResult> {
    console.log(`🔄 UsersService: Fetching users - page ${page}, results ${results}`);
    
    const params = new HttpParams()
      .set('page', page.toString())
      .set('results', results.toString())
      .set('seed', 'awork'); // Consistent seed for reproducible results

    return this.http.get<ApiResult>(this.baseUrl, { params }).pipe(
      map(response => {
        // Check if the API returned an error in the response body (rate limiting)
        if ((response as any).error) {
          console.error('🚨 UsersService: API returned error in response body', (response as any).error);
          throw new Error(`API Error: ${(response as any).error}`);
        }
        return response;
      }),
      tap(response => {
        console.log('✅ UsersService: API Response received', {
          page: response.info?.page,
          results: response.results?.length,
          seed: response.info?.seed
        });
      }),
      catchError(error => {
        console.error('❌ UsersService: API Error', error);
        return this.handleApiError(error, page, results);
      })
    );
  }

  /**
   * Load next page of users with automatic fallback for rate limiting
   * Maintains 5000-item pagination requirement while handling API constraints
   */
  loadNextPage(results = 5000): Observable<User[]> {
    const currentPagination = this.paginationSubject.value;
    
    if (currentPagination.loading || !currentPagination.hasMore) {
      return of([]);
    }

    this.updatePagination({ loading: true, error: undefined });

    return this.getUsers(currentPagination.page, results).pipe(
      map(response => {
        const users = User.mapFromUserResult(response.results || []);
        const currentUsers = this.allUsersSubject.value;
        
        // Append new users to existing ones (pagination behavior)
        const updatedUsers = currentPagination.page === 1 ? users : [...currentUsers, ...users];
        this.allUsersSubject.next(updatedUsers);

        // Update pagination state
        this.updatePagination({
          page: currentPagination.page + 1,
          results,
          hasMore: users.length === results, // More pages if we got full page
          loading: false
        });

        console.log(`📊 UsersService: Page ${currentPagination.page} loaded - ${users.length} users, total: ${updatedUsers.length}`);
        return updatedUsers;
      }),
      catchError(error => {
        console.error('❌ UsersService: Error in loadNextPage', error);
        this.updatePagination({ 
          loading: false, 
          error: error.message || 'Failed to load users'
        });
        return of(this.allUsersSubject.value); // Return current users on error
      })
    );
  }

  /**
   * Reset pagination and load first page
   */
  resetAndLoad(results = 5000): Observable<User[]> {
    console.log('🔄 UsersService: Resetting pagination and loading first page');
    this.allUsersSubject.next([]);
    this.paginationSubject.next({
      page: 1,
      results,
      hasMore: true,
      loading: false
    });
    return this.loadNextPage(results);
  }

  /**
   * Search users by term (client-side)
   */
  searchUsers(searchTerm: string): Observable<User[]> {
    return this.allUsers$.pipe(
      map(users => {
        if (!searchTerm.trim()) {
          return users;
        }

        const term = searchTerm.toLowerCase();
        return users.filter(user =>
          (user.firstname?.toLowerCase().includes(term)) ||
          (user.lastname?.toLowerCase().includes(term)) ||
          (user.email?.toLowerCase().includes(term)) ||
          (user.phone?.includes(term)) ||
          (user.nat?.toLowerCase().includes(term)) ||
          (user.country?.toLowerCase().includes(term)) ||
          (user.city?.toLowerCase().includes(term))
        );
      })
    );
  }

  /**
   * Get current users synchronously
   */
  getCurrentUsers(): User[] {
    return this.allUsersSubject.value;
  }

  /**
   * Get current pagination state synchronously
   */
  getCurrentPagination(): PaginationInfo {
    return this.paginationSubject.value;
  }

  /**
   * Handle API errors with smart fallback for rate limiting
   * When getting rate limited, implement back-off strategy
   */
  private handleApiError(error: HttpErrorResponse | Error, page: number, results: number): Observable<ApiResult> {
    console.error('🚨 UsersService: Handling API error', { 
      status: (error as HttpErrorResponse).status, 
      message: error.message,
      page,
      results
    });

    // Handle rate limiting (either HTTP 429 or error message containing rate limit info)
    const isRateLimit = (error as HttpErrorResponse).status === 429 || 
                       error.message.includes('ease up') || 
                       error.message.includes('bandwidth');

    if (isRateLimit) {
      console.log(`⚠️ Rate limited! Stopping requests for this session.`);
      
      // Update pagination to stop further requests
      this.updatePagination({ 
        loading: false, 
        hasMore: false,
        error: 'API rate limit exceeded. The Random User API has limited this session due to too many requests. Please wait a few minutes and refresh the page to try again.'
      });
    }

    // Create error response that matches ApiResult interface
    const errorResponse: ApiResult = {
      results: [],
      info: {
        seed: 'awork',
        results: 0,
        page: page
      }
    };

    // Update pagination with error state
    this.updatePagination({ 
      loading: false, 
      hasMore: false,
      error: this.getErrorMessage(error)
    });

    return of(errorResponse);
  }

  /**
   * Get user-friendly error message based on HTTP status or error instance
   */
  private getErrorMessage(error: HttpErrorResponse | Error): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 429:
          return 'API rate limit exceeded. The Random User API limits requests for large datasets. Try refreshing in a moment.';
        case 0:
          return 'Network connection failed. Please check your internet connection.';
        case 500:
        case 502:
        case 503:
          return 'Server temporarily unavailable. Please try again later.';
        case 404:
          return 'API endpoint not found. Please verify the service is available.';
        default:
          return `Request failed: ${error.message || 'Unknown error occurred'}`;
      }
    } else {
      // Handle regular Error instances (like rate limiting error from response body)
      if (error.message.includes('ease up') || error.message.includes('bandwidth')) {
        return 'API rate limit exceeded. Too many requests have been made recently. Please wait a few minutes and refresh the page.';
      }
      return `API Error: ${error.message}`;
    }
  }

  /**
   * Update pagination state
   */
  private updatePagination(updates: Partial<PaginationInfo>): void {
    const current = this.paginationSubject.value;
    this.paginationSubject.next({ ...current, ...updates });
  }
}
