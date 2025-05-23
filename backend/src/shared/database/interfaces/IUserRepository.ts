import {IUser} from 'shared/interfaces/Models';

/**
 * Interface representing a repository for user-related operations.
 */
export interface IUserRepository {
  /**
   * Creates a new user.
   * @param user - The user to create.
   * @returns A promise that resolves to the created user.
   */
  create(user: IUser): Promise<IUser>;

  /**
   * Finds a user by their email.
   * @param email - The email of the user to find.
   * @returns A promise that resolves to the user if found, or null if not found.
   */
  findByEmail(email: string): Promise<IUser | null>;

  /**
   * Adds a role to a user.
   * @param userId - The ID of the user to add the role to.
   * @param role - The role to add.
   * @returns A promise that resolves to the updated user if successful, or null if not.
   */
  addRole(userId: string, role: string): Promise<IUser | null>;

  /**
   * Removes a role from a user.
   * @param userId - The ID of the user to remove the role from.
   * @param role - The role to remove.
   * @returns A promise that resolves to the updated user if successful, or null if not.
   */
  removeRole(userId: string, role: string): Promise<IUser | null>;

  /**
   * Updates the password of a user.
   * @param userId - The ID of the user to update the password for.
   * @param password - The new password.
   * @returns A promise that resolves to the updated user if successful, or null if not.
   */
  updatePassword(userId: string, password: string): Promise<IUser | null>;
}
