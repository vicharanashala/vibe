import User from "api/schemas/UserSchema";

// The UserInterface defines the required methods for interacting with.
export interface UserInterface {
    /**
     * Create a new user document in the database.
     * @param user - The user data to insert.
     * @returns A promise that resolves to the created user.
     */
    createUser(user: User): Promise<User>;

    /**
     * Retrieve a user document by its ID.
     * @param id - The unique identifier of the user.
     * @returns A promise that resolves to the found user or null if not found.
     */
    getUserById(id: string): Promise<User | null>;

    /**
     * Update an existing user document.
     * @param id - The unique identifier of the user.
     * @param user - A partial user object with fields to update.
     * @returns A promise that resolves to the updated user or null if not found.
     */
    updateUser(id: string, user: Partial<User>): Promise<User | null>;

    /**
     * Delete a user document from the database.
     * @param id - The unique identifier of the user.
     * @returns A promise that resolves to true if deletion was successful, false otherwise.
     */
    deleteUser(id: string): Promise<boolean>;

    /**
     * List all users in the database.
     * @returns A promise that resolves to an array of users.
     */
    listUsers(): Promise<User[]>;
}
