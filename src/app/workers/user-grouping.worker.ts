/// <reference lib="webworker" />

export interface GroupingMessage {
  users: any[];
  groupBy: GroupingCriteria;
}

export interface GroupingResult {
  groups: UserGroup[];
}

export interface UserGroup {
  key: string;
  label: string;
  users: any[];
  count: number;
}

export type GroupingCriteria = 'alphabetical' | 'nationality' | 'age' | 'gender';

addEventListener('message', ({ data }: MessageEvent<GroupingMessage>) => {
  const result = groupUsers(data.users, data.groupBy);
  postMessage(result);
});

function groupUsers(users: any[], groupBy: GroupingCriteria): GroupingResult {
  const groups = new Map<string, any[]>();

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
        const ageGroup = getAgeGroup(user.age || 0);
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

  // Sort groups and convert to array
  const sortedGroups = Array.from(groups.entries())
    .map(([key, groupUsers]) => {
      const sortedUsers = [...groupUsers].sort((a, b) => 
        (a.firstname || '').localeCompare(b.firstname || '')
      );
      
      let label: string;
      if (key === 'Unknown') {
        label = 'Unknown';
      } else if (groupBy === 'nationality') {
        label = getNationalityName(key);
      } else if (groupBy === 'age') {
        const ageGroup = getAgeGroup(Number.parseInt(key.split('-')[0]) || 0);
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

  return { groups: sortedGroups };
}

function getAgeGroup(age: number): { key: string; label: string } {
  if (age < 18) return { key: '0-17', label: 'Under 18' };
  if (age < 25) return { key: '18-24', label: '18-24 years' };
  if (age < 35) return { key: '25-34', label: '25-34 years' };
  if (age < 45) return { key: '35-44', label: '35-44 years' };
  if (age < 55) return { key: '45-54', label: '45-54 years' };
  if (age < 65) return { key: '55-64', label: '55-64 years' };
  return { key: '65+', label: '65+ years' };
}

function getNationalityName(code: string): string {
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