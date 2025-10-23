import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserListComponent } from './user-list.component';
import { UsersService } from '../../services/users.service'
import { UsersServiceStub } from '../../services/users.service.stub'
import { User } from '../../models/user.model'
import { MockResult } from '../../mock-data'
import { UserResult } from '../../models/api-result.model'
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { UserGroupingService, GroupingCriteria, UserGroup } from '../../services/user-grouping.service';
import { Subject, BehaviorSubject } from 'rxjs';

class UserGroupingServiceStub {
  private readonly groupingSubject = new Subject<{ groups: UserGroup[] }>();
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  public grouping$ = this.groupingSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  groupUsers(users: User[], groupBy: GroupingCriteria): void {
    this.loadingSubject.next(true);
    setTimeout(() => {
      // Use the same sync grouping logic as fallbackGrouping
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
        case 'alphabetical': key = user.firstname ? user.firstname.charAt(0).toUpperCase() : 'Unknown'; break;
        case 'nationality': key = user.nat || 'Unknown'; break;
        case 'age': key = this.getAgeGroup(user.age || 0).key; break;
        case 'gender': key = user.gender || 'Unknown'; break;
        default: key = 'All';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(user);
    }
    return Array.from(groups.entries()).map(([key, groupUsers]) => ({
      key,
      label: key,
      users: groupUsers,
      count: groupUsers.length
    }));
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
}

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;

  const mockedUsers = User.mapFromUserResult(MockResult.results as UserResult[])

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserListComponent, BrowserAnimationsModule],
      providers: [
        {
          provide: UsersService,
          useClass: UsersServiceStub
        },
        {
          provide: UserGroupingService,
          useClass: UserGroupingServiceStub
        }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    fixture.componentRef.setInput('users', mockedUsers);

    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should group users alphabetically by default', (done) => {
    component.currentGrouping.set('alphabetical');
    component.refreshGrouping();
    setTimeout(() => {
      fixture.detectChanges();
      const groups = component.groupedUsers();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]?.key).toMatch(/[A-Z]/);
      done();
    }, 10);
  });

  it('should group users by nationality', (done) => {
    component.changeGrouping('nationality');
    setTimeout(() => {
      fixture.detectChanges();
      const groups = component.groupedUsers();
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]?.key.length).toBeGreaterThanOrEqual(2); // e.g., 'US', 'DE', 'Unknown'
      done();
    }, 10);
  });

  it('should group users by age', (done) => {
    component.changeGrouping('age');
    setTimeout(() => {
      fixture.detectChanges();
      const groups = component.groupedUsers();
      expect(groups.length).toBeGreaterThan(0);
      // Accept both '65+' and labels containing 'years'
      expect(groups[0]?.label === '65+' || (groups[0]?.label?.includes('years'))).toBeTrue();
      done();
    }, 10);
  });

  it('should group users by gender', (done) => {
    component.changeGrouping('gender');
    setTimeout(() => {
      fixture.detectChanges();
      const groups = component.groupedUsers();
      expect(groups.length).toBeGreaterThan(0);
      const label = groups[0]?.label?.toLowerCase();
      expect(['male', 'female', 'unknown']).toContain(label);
      done();
    }, 10);
  });

  it('should filter users by search term', (done) => {
    // Use a value that is guaranteed to match at least one user, and test case-insensitivity
    const firstUser = mockedUsers[0];
    let searchValue = '';
    if (firstUser.firstname) searchValue = firstUser.firstname.toLowerCase();
    else if (firstUser.lastname) searchValue = firstUser.lastname.toLowerCase();
    else if (firstUser.email) searchValue = firstUser.email.toLowerCase();
    else searchValue = 'a'; // fallback, should match something in mock data

    component.onSearchInput({ target: { value: searchValue } } as any);
    fixture.detectChanges();
    setTimeout(() => {
      fixture.detectChanges();
      expect(component.filteredUsers().length).toBeGreaterThan(0);
      done();
    }, 10);
  });

  it('should toggle group view', () => {
    const initial = component.showGrouped();
    component.toggleGroupView();
    expect(component.showGrouped()).toBe(!initial);
  });

  it('should expand and collapse a user', () => {
    const userId = mockedUsers[0].login?.uuid || '';
    component.toggleUserExpansion(userId);
    expect(component.expandedUser()).toBe(userId);
    component.toggleUserExpansion(userId);
    expect(component.expandedUser()).toBe(null);
  });
});
