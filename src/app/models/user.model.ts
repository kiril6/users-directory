import { UserResult } from './api-result.model'

interface LoginInfo extends Object {
  uuid: string
  username: string
  password: string
  salt: string
  md5: string
  sha1: string
  sha256: string
}

export class User {
  firstname?: string
  lastname?: string
  email?: string
  phone?: string
  image?: string
  nat?: string
  login?: LoginInfo
  dateOfBirth?: Date
  age?: number
  gender?: string
  country?: string
  city?: string
  postcode?: string | number
  state?: string

  constructor(data: Partial<User> = {}) {
    Object.assign(this, data);
    
    // Ensure dateOfBirth is a proper Date object if it exists
    if (data.dateOfBirth && typeof data.dateOfBirth === 'string') {
      this.dateOfBirth = new Date(data.dateOfBirth);
    }
  }

  /**
   * Gets an image source url with a query string to prevent caching
   * Note: Do not remove the query string.
   */
  get imageSrc(): string {
    if (!this.image) {
      return 'https://via.placeholder.com/56?text=?'; // Fallback placeholder
    }
    return `${this.image}?id=${this.login?.uuid || 'unknown'}`;
  }

  /**
   * Gets the full name of the user
   */
  get fullName(): string {
    return `${this.firstname || ''} ${this.lastname || ''}`.trim() || 'Unknown User';
  }

  /**
   * Maps the api result to an array of User objects
   * @param {UserResult[]} userResults
   * @returns {User[]}
   */
  static mapFromUserResult(userResults: UserResult[]): User[] {
    return userResults.map(user => new User({
      firstname: user.name.first,
      lastname: user.name.last,
      email: user.email,
      phone: user.phone,
      image: user.picture.medium,
      nat: user.nat,
      login: user.login,
      dateOfBirth: new Date(user.dob.date),
      age: user.dob.age,
      gender: user.gender,
      country: user.location.country,
      city: user.location.city,
      postcode: user.location.postcode,
      state: user.location.state
    }))
  }
}
