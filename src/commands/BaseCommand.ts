import { UntitledClient, BaseArgumentCollector, BaseCommandGroup, BaseMessage } from '../';
import { GuildExtension } from '../extensions/GuildExtension';
import { Throttle, ThrottlingOptions, ArgumentInfo, CommandInfo } from '../types';
import { GuildResolvable, Message, Snowflake, User, Guild } from 'discord.js';
import * as path from 'path';

export class BaseCommand<T extends UntitledClient = UntitledClient> {
	public client: T;
	public name: string;
	public aliases: string[];
	public autoAliases: boolean;
	public groupID: string;
	public group: BaseCommandGroup;
	public memberName: string;
	public description: string;
	public format: string;
	public details: string;
	public examples: string[];
	public guildOnly: boolean;
	public throttling: ThrottlingOptions;
	public defaultHandling: boolean;
	public args: ArgumentInfo[];
	public argsCollector: BaseArgumentCollector;
	public argsPromptLimit: number;
	public argsType: string;
	public argsCount: number;
	public argsSingleQuotes: boolean;
	public patterns: RegExp[];
	public guarded: boolean;
	public _globalEnabled: boolean;
	private _throttles: Map<string, object>;

	/**
	 * Creates a usage string for a command
	 * @param {string} command - A command + arg string
	 * @param {string} [prefix] - Prefix to use for the prefixed command format
	 * @param {User} [user] - User to use for the mention command format
	 * @return {string}
	 */
	static usage(command: string, prefix: string = null, user: User = null): string {
		const nbcmd: string = command.replace(/ /g, '\xa0');
		if (!prefix && !user) return `\`${nbcmd}\``;

		let prefixPart: string;
		if (prefix) {
			if (prefix.length > 1 && !prefix.endsWith(' ')) prefix += ' ';
			prefix = prefix.replace(/ /g, '\xa0');
			prefixPart = `\`${prefix}${nbcmd}\``;
		}

		let mentionPart: string;
		if (user) mentionPart = `\`@${user.username.replace(/ /g, '\xa0')}#${user.discriminator}\xa0${nbcmd}\``;

		return `${prefixPart || ''}${prefix && user ? ' or ' : ''}${mentionPart || ''}`;
	}

	/**
	 * @param {UntitledClient} client - The client the command is for
	 * @param {CommandInfo} info - The command information
	 */
	public constructor(client: T, info: CommandInfo) {
		Object.assign(this, info);
		this.validateInfo();
		this.cantThinkOfAName(client);
		/**
		 * Client that this command is for
		 * @name BaseCommand#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = client;

		/**
		 * Name of this command
		 * @type {string}
		 */

		/**
		 * Aliases for this command
		 * @type {string[]}
		 */

		/**
		 * ID of the group the command belongs to
		 * @type {string}
		 */

		/**
		 * The group the command belongs to, assigned upon registration
		 * @type {?BaseCommandGroup}
		 */
		this.group = null;

		/**
		 * Name of the command within the group
		 * @type {string}
		 */

		/**
		 * Short description of the command
		 * @type {string}
		 */

		/**
		 * Usage format string of the command
		 * @type {string}
		 */

		/**
		 * Long description of the command
		 * @type {?string}
		 */

		/**
		 * Example usage strings
		 * @type {?string[]}
		 */

		/**
		 * Whether the command can only be run in a guild channel
		 * @type {boolean}
		 */

		/**
		 * Whether the default command handling is enabled for the command
		 * @type {boolean}
		 */

		/**
		 * Options for throttling command usages
		 * @type {?ThrottlingOptions}
		 */

		/**
		 * The argument collector for the command
		 * @type {?BaseArgumentCollector}
		 */

		/**
		 * How the arguments are split when passed to the command's run method
		 * @type {string}
		 */

		/**
		 * Maximum number of arguments that will be split
		 * @type {number}
		 */

		/**
		 * Whether single quotes are allowed to encapsulate an argument
		 * @type {boolean}
		 */

		/**
		 * Regular expression triggers
		 * @type {RegExp[]}
		 */

		/**
		 * Whether the command is protected from being disabled
		 * @type {boolean}
		 */

		/**
		 * Whether the command is enabled globally
		 * @type {boolean}
		 * @private
		 */
		this._globalEnabled = true;

		/**
		 * Current throttle objects for the command, mapped by user ID
		 * @type {Map<string, Object>}
		 * @private
		 */
		this._throttles = new Map();
	}

	/**
	 * Validates the constructor parameters
	 * @private
	 */
	private validateInfo(): void {
		if (typeof this.name !== 'string') throw new TypeError('Command name must be a string.');
		if (this.name !== this.name.toLowerCase()) throw new Error('Command name must be lowercase.');
		if (this.aliases && (!Array.isArray(this.aliases) || this.aliases.some((ali: string) => typeof ali !== 'string'))) {
			throw new TypeError('Command aliases must be an Array of strings.');
		}
		if (this.aliases && this.aliases.some((ali: string) => ali !== ali.toLowerCase())) {
			throw new Error('Command aliases must be lowercase.');
		}
		if (typeof this.groupID !== 'string') throw new TypeError('Command group must be a string.');
		if (this.groupID !== this.groupID.toLowerCase()) throw new Error('Command group must be lowercase.');
		if (typeof this.memberName !== 'string') throw new TypeError('Command memberName must be a string.');
		if (this.memberName !== this.memberName.toLowerCase()) throw new Error('Command memberName must be lowercase.');
		if (typeof this.description !== 'string') throw new TypeError('Command description must be a string.');
		if ('format' in this && typeof this.format !== 'string') throw new TypeError('Command format must be a string.');
		if ('details' in this && typeof this.details !== 'string') throw new TypeError('Command details must be a string.');
		if (this.examples && (!Array.isArray(this.examples) || this.examples.some((ex: string) => typeof ex !== 'string'))) {
			throw new TypeError('Command examples must be an Array of strings.');
		}
		if (this.throttling) {
			if (typeof this.throttling !== 'object') throw new TypeError('Command throttling must be an Object.');
			if (typeof this.throttling.usages !== 'number' || isNaN(this.throttling.usages)) {
				throw new TypeError('Command throttling usages must be a number.');
			}
			if (this.throttling.usages < 1) throw new RangeError('Command throttling usages must be at least 1.');
			if (typeof this.throttling.duration !== 'number' || isNaN(this.throttling.duration)) {
				throw new TypeError('Command throttling duration must be a number.');
			}
			if (this.throttling.duration < 1) throw new RangeError('Command throttling duration must be at least 1.');
		}
		if (this.args && !Array.isArray(this.args)) throw new TypeError('Command args must be an Array.');
		if ('argsPromptLimit' in this && typeof this.argsPromptLimit !== 'number') {
			throw new TypeError('Command argsPromptLimit must be a number.');
		}
		if ('argsPromptLimit' in this && this.argsPromptLimit < 0) {
			throw new RangeError('Command argsPromptLimit must be at least 0.');
		}
		if (this.argsType && !['single', 'multiple'].includes(this.argsType)) {
			throw new RangeError('Command argsType must be one of "single" or "multiple".');
		}
		if (this.argsType === 'multiple' && this.argsCount && this.argsCount < 2) {
			throw new RangeError('Command argsCount must be at least 2.');
		}
		if (this.patterns && (!Array.isArray(this.patterns) || this.patterns.some((pat: RegExp) => !(pat instanceof RegExp)))) {
			throw new TypeError('Command patterns must be an Array of regular expressions.');
		}
	}

	/**
	 * TODO: Document properly
	 * @param {UntitledClient} client - Client to validate
	 * @private
	 */
	private cantThinkOfAName(client: T): void {
		if (typeof this.aliases === 'undefined') this.aliases = [];
		if (typeof this.autoAliases === 'undefined' || this.autoAliases) {
			if (this.name.includes('-')) this.aliases.push(this.name.replace(/-/g, ''));
			for (const alias of this.aliases) {
				if (alias.includes('-')) this.aliases.push(alias.replace(/-/g, ''));
			}
		}
		if (typeof this.format === 'undefined') this.format = null;
		if (typeof this.details === 'undefined') this.details = null;
		if (typeof this.examples === 'undefined') this.examples = null;
		if (typeof this.guildOnly === 'undefined') this.guildOnly = false;
		if (typeof this.defaultHandling === 'undefined') this.defaultHandling = true;
		if (typeof this.throttling === 'undefined') this.throttling = null;
		if (typeof this.args === 'undefined') this.argsCollector = null;
		else this.argsCollector = new BaseArgumentCollector(client, this.args, this.argsPromptLimit);
		if (this.argsCollector && typeof this.format === 'undefined') {
			this.format = this.argsCollector.args.reduce((prev, arg) => {
				const wrapL: string = arg.default !== null ? '[' : '<';
				const wrapR: string = arg.default !== null ? ']' : '>';
				return `${prev}${prev ? ' ' : ''}${wrapL}${arg.label}${arg.infinite ? '...' : ''}${wrapR}`;
			}, '');
		}
		if (typeof this.argsType === 'undefined') this.argsType = 'single';
		if (typeof this.argsCount === 'undefined') this.argsCount = 0;
		if (typeof this.argsSingleQuotes === 'undefined') this.argsSingleQuotes = true;
		if (typeof this.patterns === 'undefined') this.patterns = null;
		if (typeof this.guarded === 'undefined') this.guarded = false;
	}

	/**
	 * Checks a user's permission in a guild
	 * @param {BaseMessage} message - The triggering command message
	 * @return {boolean|string} Whether the user has permission, or an error message to respond with if they don't
	 */
	public hasPermission(message: BaseMessage): boolean | string {
		return true;
	}

	/**
	 * Runs the command
	 * @param {BaseMessage} message - The message the command is being run for
	 * @param {Object|string|string[]} args - The arguments for the command, or the matches from a pattern.
	 * If args is specified on the command, this will be the argument values object. If argsType is single, then only
	 * one string will be passed. If multiple, an array of strings will be passed. When fromPattern is true, this is the
	 * matches array from the pattern match
	 * (see [RegExp#exec](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec)).
	 * @param {boolean} fromPattern - Whether or not the command is being run from a pattern match
	 * @return {Promise<?Message|?Array<Message>>}
	 * @abstract
	 */
	public async run(message: BaseMessage, args: object | string | string[], fromPattern: boolean): Promise<Message | Message[]> {
		throw new Error(`${this.constructor.name} doesn't have a run() method.`);
	}

	/**
	 * Creates/obtains the throttle object for a user, if necessary (owners are excluded)
	 * @param {string} userID - ID of the user to throttle for
	 * @return {?Object}
	 * @private
	 */
	public throttle(userID: Snowflake): object {
		if (!this.throttling || this.client.isOwner(userID)) return null;

		let throttle: Throttle = this._throttles.get(userID);
		if (!throttle) {
			throttle = {
				start: Date.now(),
				usages: 0,
				timeout: this.client.setTimeout(() => {
					this._throttles.delete(userID);
				}, this.throttling.duration * 1000)
			};
			this._throttles.set(userID, throttle);
		}

		return throttle;
	}

	/**
	 * Enables or disables the command in a guild
	 * @param {?GuildResolvable} guild - Guild to enable/disable the command in
	 * @param {boolean} enabled - Whether the command should be enabled or disabled
	 */
	public setEnabledIn(guild: GuildResolvable, enabled: boolean): void {
		if (typeof guild === 'undefined') throw new TypeError('Guild must not be undefined.');
		if (typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		if (this.guarded) throw new Error('The command is guarded.');
		if (!guild) {
			this._globalEnabled = enabled;
			this.client.emit('commandStatusChange', null, this, enabled);
			return;
		}
		guild = (this as any).client.resolver.resolveGuild(guild);
		(guild as GuildExtension).setCommandEnabled(this, enabled);
	}

	/**
	 * Checks if the command is enabled in a guild
	 * @param {?GuildResolvable} guild - Guild to check in
	 * @return {boolean}
	 */
	public isEnabledIn(guild: GuildResolvable): boolean {
		if (this.guarded) return true;
		if (!guild) return this.group._globalEnabled && this._globalEnabled;
		guild = (this.client as any).resolver.resolveGuild(guild);
		return (guild as GuildExtension).isGroupEnabled(this.group) && (guild as GuildExtension).isCommandEnabled(this);
	}

	/**
	 * Checks if the command is usable for a message
	 * @param {?BaseMessage} message - The message
	 * @return {boolean}
	 */
	public isUsable(message: BaseMessage = null): boolean {
		if (!message) return this._globalEnabled;
		if (this.guildOnly && message && !message.guild) return false;
		const hasPermission: string | boolean = this.hasPermission(message);
		return this.isEnabledIn(message.guild) && hasPermission && typeof hasPermission !== 'string';
	}

	/**
	 * Creates a usage string for the command
	 * @param {string} [argString] - A string of arguments for the command
	 * @param {string} [prefix=this.client.commandPrefix] - Prefix to use for the prefixed command format
	 * @param {User} [user=this.client.user] - User to use for the mention command format
	 * @return {string}
	 */
	public usage(argString: string, prefix: string = this.client.commandPrefix, user: User = this.client.user): string {
		return (this.constructor as typeof BaseCommand).usage(`${this.name}${argString ? ` ${argString}` : ''}`, prefix, user);
	}

	/**
	 * Reloads the command
	 */
	public reload(): void {
		let cmdPath: string;
		let cached: string;
		let newCmd: BaseCommand<UntitledClient>;
		try {
			cmdPath = this.client.registry.resolveCommandPath(this.groupID, this.memberName);
			cached = require.cache[cmdPath];
			delete require.cache[cmdPath];
			newCmd = require(cmdPath);
		} catch (err) {
			if (cached) require.cache[cmdPath] = cached;
			try {
				cmdPath = path.join(__dirname, this.groupID, `${this.memberName}.js`);
				cached = require.cache[cmdPath];
				delete require.cache[cmdPath];
				newCmd = require(cmdPath);
			} catch (err2) {
				if (cached) require.cache[cmdPath] = cached;
				if (err2.message.includes('Cannot find module')) throw err; else throw err2;
			}
		}

		this.client.registry.reregisterCommand(newCmd, this);
	}

	/**
	 * Unloads the command
	 */
	public unload(): void {
		const cmdPath: string = this.client.registry.resolveCommandPath(this.groupID, this.memberName);
		if (!require.cache[cmdPath]) throw new Error('Command cannot be unloaded.');
		delete require.cache[cmdPath];
		this.client.registry.unregisterCommand(this);
	}
}
