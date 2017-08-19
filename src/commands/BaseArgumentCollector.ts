import { UntitledClient, BaseArgument, BaseMessage } from '../';
import { Message } from 'discord.js';
import { ArgumentInfo, ArgumentCollectorResult } from '../types';

export class BaseArgumentCollector<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public args: BaseArgument[];
	public promptLimit: number;

	/**
	 * @param {ArgumentInfo[]} args - Arguments for the collector
	 * @param {number} [promptLimit=Infinity] - Maximum number of times to prompt for a single argument
	 */
	public constructor(client: T, args: ArgumentInfo[], promptLimit: number = Infinity) {
		if (!args || !Array.isArray(args)) throw new TypeError('Collector args must be an Array.');
		if (promptLimit === null) promptLimit = Infinity;

		/**
		 * Client this collector is for
		 * @name ArgumentCollector#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = client;

		/**
		 * Arguments the collector handles
		 * @type {Argument[]}
		 */
		this.args = new Array(args.length);

		let hasInfinite = false;
		let hasOptional = false;
		for (let i = 0; i < args.length; i++) {
			if (hasInfinite) throw new Error('No other argument may come after an infinite argument.');
			if (args[i].default !== null) hasOptional = true;
			else if (hasOptional) throw new Error('Required arguments may not come after optional arguments.');
			this.args[i] = new BaseArgument(this.client, args[i]);
			if (this.args[i].infinite) hasInfinite = true;
		}

		/**
		 * Maximum number of times to prompt for a single argument
		 * @type {number}
		 */
		this.promptLimit = promptLimit;
	}

	/**
	 * Obtains values for the arguments, prompting if necessary.
	 * @param {BaseMessage} msg - Message that the collector is being triggered by
	 * @param {Array<*>} [provided=[]] - Values that are already available
	 * @param {number} [promptLimit=this.promptLimit] - Maximum number of times to prompt for a single argument
	 * @return {Promise<ArgumentCollectorResult>}
	 */
	public async obtain(msg: BaseMessage, provided: any[] = [], promptLimit: number = this.promptLimit): Promise<ArgumentCollectorResult> {
		this.client.dispatcher._awaiting.add(msg.message.author.id + msg.message.channel.id);
		const values: { [key: string]: object } = {};
		const results: ArgumentCollectorResult[] = [];

		try {
			for (let i = 0; i < this.args.length; i++) {
				const arg: BaseArgument = this.args[i];
				const result: ArgumentCollectorResult = await arg.obtain(msg, arg.infinite ? provided.slice(i) : provided[i], promptLimit);
				results.push(result);

				if (result.cancelled) {
					this.client.dispatcher._awaiting.delete(msg.message.author.id + msg.message.channel.id);
					return {
						values: null,
						cancelled: result.cancelled,
						prompts: [].concat(...results.map(res => res.prompts)),
						answers: [].concat(...results.map(res => res.answers))
					};
				}

				values[arg.key] = result.values;
			}
		} catch (err) {
			this.client.dispatcher._awaiting.delete(msg.message.author.id + msg.message.channel.id);
			throw err;
		}

		this.client.dispatcher._awaiting.delete(msg.message.author.id + msg.message.channel.id);
		return {
			values,
			cancelled: null,
			prompts: [].concat(...results.map(res => res.prompts)),
			answers: [].concat(...results.map(res => res.answers))
		};
	}
}
