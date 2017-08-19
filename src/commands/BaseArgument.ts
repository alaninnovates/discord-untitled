import { UntitledClient, BaseArgumentType, BaseMessage } from '../';
import { ArgumentInfo, ArgumentResult } from '../types';
import { Collection, Message, Util } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';

export class BaseArgument {
	public key: string;
	public label?: string;
	public prompt: string;
	public type?: BaseArgumentType;
	public max?: number;
	public min?: number;
	public default?: any;
	public infinite?: boolean;
	public validator?: (val: string, msg: BaseMessage, arg: BaseArgument) => any | Promise<any>;
	public parser?: (val: string, msg: BaseMessage, arg: BaseArgument) => any | Promise<any>;
	public wait?: number;

	/**
	 * Validates the constructor parameters
	 * @param {UntitledClient} client - Client to validate
	 * @param {ArgumentInfo} info - Info to validate
	 * @private
	 */
	private static validateInfo(client: UntitledClient, info: ArgumentInfo) {
		if (!client) throw new Error('The argument client must be specified.');
		if (typeof info !== 'object') throw new TypeError('Argument info must be an Object.');
		if (typeof info.key !== 'string') throw new TypeError('Argument key must be a string.');
		if (info.label && typeof info.label !== 'string') throw new TypeError('Argument label must be a string.');
		if (typeof info.prompt !== 'string') throw new TypeError('Argument prompt must be a string.');
		if (!info.type && !info.validate) {
			throw new Error('Argument must have either "type" or "validate" specified.');
		}
		if (info.type && !client.registry.types.has(info.type)) {
			throw new RangeError(`Argument type "${info.type}" isn't registered.`);
		}
		if (info.validate && typeof info.validate !== 'function') {
			throw new TypeError('Argument validate must be a function.');
		}
		if (info.parse && typeof info.parse !== 'function') {
			throw new TypeError('Argument parse must be a function.');
		}
		if (!info.type && (!info.validate || !info.parse)) {
			throw new Error('Argument must have both validate and parse since it doesn\'t have a type.');
		}
		if (typeof info.wait !== 'undefined' && (typeof info.wait !== 'number' || Number.isNaN(info.wait))) {
			throw new TypeError('Argument wait must be a number.');
		}
	}

	/**
	 * @param {UntitledClient} client - Client the argument is for
	 * @param {ArgumentInfo} info - Information for the command argument
	 */
	public constructor(client: UntitledClient, info: ArgumentInfo) {
		(this.constructor as typeof BaseArgument).validateInfo(client, info);

		/**
		 * Key for the argument
		 * @type {string}
		 */
		this.key = info.key;

		/**
		 * Label for the argument
		 * @type {string}
		 */
		this.label = info.label || info.key;

		/**
		 * Question prompt for the argument
		 * @type {string}
		 */
		this.prompt = info.prompt;

		/**
		 * Type of the argument
		 * @type {?ArgumentType}
		 */
		this.type = info.type ? client.registry.types.get(info.type) : null;

		/**
		 * If type is `integer` or `float`, this is the maximum value of the number.
		 * If type is `string`, this is the maximum length of the string.
		 * @type {?number}
		 */
		this.max = info.max || null;

		/**
		 * If type is `integer` or `float`, this is the minimum value of the number.
		 * If type is `string`, this is the minimum length of the string.
		 * @type {?number}
		 */
		this.min = info.min || null;

		/**
		 * The default value for the argument
		 * @type {?*}
		 */
		this.default = typeof info.default !== 'undefined' ? info.default : null;

		/**
		 * Whether the argument accepts an infinite number of values
		 * @type {boolean}
		 */
		this.infinite = Boolean(info.infinite);

		/**
		 * Validator function for validating a value for the argument
		 * @type {?Function}
		 * @see {@link ArgumentType#validate}
		 */
		this.validator = info.validate || null;

		/**
		 * Parser function for parsing a value for the argument
		 * @type {?Function}
		 * @see {@link ArgumentType#parse}
		 */
		this.parser = info.parse || null;

		/**
		 * How long to wait for input (in seconds)
		 * @type {number}
		 */
		this.wait = typeof info.wait !== 'undefined' ? info.wait : 30;
	}

	/**
	 * Prompts the user and obtains the value for the argument
	 * @param {BaseMessage} msg - Message that triggered the command
	 * @param {string} [value] - Pre-provided value for the argument
	 * @param {number} [promptLimit=Infinity] - Maximum number of times to prompt for the argument
	 * @return {Promise<ArgumentResult>}
	 */
	public async obtain(msg: BaseMessage, value: string, promptLimit: number = Infinity): Promise<ArgumentResult> {
		if (!value && this.default !== null) {
			return {
				values: this.default,
				cancelled: null,
				prompts: [],
				answers: []
			};
		}
		if (this.infinite) return this.obtainInfinite(msg, value, promptLimit);

		const wait: number = this.wait > 0 && this.wait !== Infinity ? this.wait * 1000 : undefined;
		const prompts: Message[] = [];
		const answers: Message[] = [];
		let valid: boolean = value ? await this.validate(value, msg) : false;

		while (!valid || typeof valid === 'string') {
			if (prompts.length >= promptLimit) {
				return {
					values: null,
					cancelled: 'promptLimit',
					prompts,
					answers
				};
			}

			prompts.push((await msg.reply(stripIndents`
				${!value ? this.prompt : valid ? valid : `You provided an invalid ${this.label}. Please try again.`}
				${oneLine`
					Respond with \`cancel\` to cancel the command.
					${wait ? `The command will automatically be cancelled in ${this.wait} seconds.` : ''}
				`}
			`) as Message));

			const responses: Collection<string, Message> = await msg.channel.awaitMessages((msg2: Message) => msg2.author.id === msg.author.id, {
				max: 1,
				time: wait
			});

			if (responses && responses.size === 1) {
				answers.push(responses.first());
				value = answers[answers.length - 1].content;
			} else {
				return {
					values: null,
					cancelled: 'time',
					prompts,
					answers
				};
			}

			if (value.toLowerCase() === 'cancel') {
				return {
					values: null,
					cancelled: 'user',
					prompts,
					answers
				};
			}

			valid = await this.validate(value, msg);
		}

		return {
			values: await this.parse(value, msg),
			cancelled: null,
			prompts,
			answers
		};
	}

	/**
	 * Prompts the user and obtains multiple values for the argument
	 * @param {BaseMessage} msg - Message that triggered the command
	 * @param {string[]} [values] - Pre-provided values for the argument
	 * @param {number} [promptLimit=Infinity] - Maximum number of times to prompt for the argument
	 * @return {Promise<ArgumentResult>}
	 * @private
	 */
	private async obtainInfinite(msg: BaseMessage, values: string | string[], promptLimit: number = Infinity): Promise<ArgumentResult> {
		const wait: number = this.wait > 0 && this.wait !== Infinity ? this.wait * 1000 : undefined;
		const results: string[] = [];
		const prompts: Message[] = [];
		const answers: Message[] = [];
		let currentVal = 0;

		while (true) {
			let value: string = values && values[currentVal] ? values[currentVal] : null;
			let valid: boolean = value ? await this.validate(value, msg) : false;
			let attempts = 0;

			while (!valid || typeof valid === 'string') {
				attempts++;
				if (attempts > promptLimit) {
					return {
						values: null,
						cancelled: 'promptLimit',
						prompts,
						answers
					};
				}

				if (value) {
					const escaped: string = Util.escapeMarkdown(value).replace(/@/g, '@\u200b');
					prompts.push((await msg.reply(stripIndents`
						${valid ? valid : oneLine`
							You provided an invalid ${this.label},
							"${escaped.length < 1850 ? escaped : '[too long to show]'}".
							Please try again.
						`}
						${oneLine`
							Respond with \`cancel\` to cancel the command, or \`finish\` to finish entry up to this point.
							${wait ? `The command will automatically be cancelled in ${this.wait} seconds.` : ''}
						`}
					`) as Message));
				} else if (results.length === 0) {
					prompts.push((await msg.reply(stripIndents`
						${this.prompt}
						${oneLine`
							Respond with \`cancel\` to cancel the command, or \`finish\` to finish entry.
							${wait ? `The command will automatically be cancelled in ${this.wait} seconds, unless you respond.` : ''}
						`}
					`) as Message));
				}

				const responses: Collection<string, Message> = await msg.channel.awaitMessages((msg2: Message) => msg2.author.id === msg.author.id, {
					max: 1,
					time: wait
				});

				if (responses && responses.size === 1) {
					answers.push(responses.first());
					value = answers[answers.length - 1].content;
				} else {
					return {
						values: null,
						cancelled: 'time',
						prompts,
						answers
					};
				}

				const lc: string = value.toLowerCase();
				if (lc === 'finish') {
					return {
						values: results.length > 0 ? results : null,
						cancelled: results.length > 0 ? null : 'user',
						prompts,
						answers
					};
				}
				if (lc === 'cancel') {
					return {
						values: null,
						cancelled: 'user',
						prompts,
						answers
					};
				}

				valid = await this.validate(value, msg);
			}

			results.push(await this.parse(value, msg));

			if (values) {
				currentVal++;
				if (currentVal === values.length) {
					return {
						values: results,
						cancelled: null,
						prompts,
						answers
					};
				}
			}
		}
	}

	/**
	 * Checks if a value is valid for the argument
	 * @param {string} value - Value to check
	 * @param {BaseMessage} msg - Message that triggered the command
	 * @return {boolean|string|Promise<boolean|string>}
	 */
	public validate(value: string, msg: BaseMessage): any | Promise<any> {
		if (this.validator) return this.validator(value, msg, this);
		return this.type.validate(value, msg, this);
	}

	/**
	 * Parses a value string into a proper value for the argument
	 * @param {string} value - Value to parse
	 * @param {BaseMessage} msg - Message that triggered the command
	 * @return {*|Promise<*>}
	 */
	public parse(value: string, msg: BaseMessage): any | Promise<any> {
		if (this.parser) return this.parser(value, msg, this);
		return this.type.parse(value, msg, this);
	}
}
