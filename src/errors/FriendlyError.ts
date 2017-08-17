/**
 * Has a message that can be considered user-friendly
 * @extends {Error}
 */
export class FriendlyError extends Error {
	public name: string;

	/** @param {string} message - The error message */
	public constructor(message: string) {
		super(message);
		this.name = 'FriendlyError';
	}
}
