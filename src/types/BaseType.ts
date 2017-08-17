import { UntitledClient, BaseArgument, BaseMessage } from '../';

export abstract class BaseArgumentType<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public id: string;

	/**
	 * @param {string} id - The argument type ID (this is what you specify in {@link ArgumentInfo#type})
	 */
	public constructor(id: string) {
		if (typeof id !== 'string') throw new Error('Argument type ID must be a string.');
		if (id !== id.toLowerCase()) throw new Error('Argument type ID must be lowercase.');

		/**
		 * Client that this argument type is for
		 * @name ArgumentType#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = null;

		/**
		 * ID of this argument type (this is what you specify in {@link ArgumentInfo#type})
		 * @type {string}
		 */
		this.id = id;
	}

	/**
	 * Validates a value against the type
	 * @param {string} value - Value to validate
	 * @param {BaseMessage} msg - Message the value was obtained from
	 * @param {BaseArgument} arg - Argument the value obtained from
	 * @return {boolean|string|Promise<boolean|string>} Whether the value is valid, or an error message
	 * @abstract
	 */
	public validate(value: string, msg: BaseMessage, arg: BaseArgument): boolean | string | Promise<boolean | string> {
		throw new Error(`${this.constructor.name} doesn't have a validate() method.`);
	}

	/**
	 * Parses the raw value into a usable value
	 * @param {string} value - Value to parse
	 * @param {BaseMessage} msg - Message the value was obtained from
	 * @param {BaseArgument} arg - Argument the value obtained from
	 * @return {*|Promise<*>} Usable value
	 * @abstract
	 */
	public parse(value: string, msg: BaseMessage, arg: BaseArgument): any | Promise<any> {
		throw new Error(`${this.constructor.name} doesn't have a parse() method.`);
	}
}
