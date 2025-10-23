import { Observable, of, BehaviorSubject, map } from 'rxjs';
import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { UserResult } from '../models/api-result.model';
import { MockResult } from '../mock-data';
@Injectable({
  providedIn: 'root'
})
export class UsersServiceStub {
  private readonly users = User.mapFromUserResult(MockResult.results as UserResult[]);
  public allUsers$ = new BehaviorSubject(this.users);

  /**
   * Fetches 5000 mock users from the api
   * @param {number} page
   * @returns {Observable<User[]>}
   */
  getUsers(page = 1): Observable<User[]> {
    return of(this.users);
  }

  /**
   * Mimics the real UsersService searchUsers method for tests
   */
  searchUsers(searchTerm: string): Observable<User[]> {
    return this.allUsers$.pipe(
      map((users: any[]) => {
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
}
