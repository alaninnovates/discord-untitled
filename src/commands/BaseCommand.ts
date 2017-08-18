import { UntitledClient, BaseArgumentCollector, BaseCommandGroup, BaseMessage } from '../';
import { ArgumentInfo } from './BaseArgument';
import { GuildExtension } from '../extensions/GuildExtension';
import { GuildResolvable, Message, Snowflake, User, Guild } from 'discord.js';
import * as path from 'path';

export type Throttle = {
	start?: number;
	usages?: number;
	timeout?: NodeJS.Timer
};

export type ThrottlingOptions = {
	usages: number;
	duration: number;
};

export type CommandInfo = {
	name: string;
	aliases?: string[];
	autoAliases?: boolean;
	group: string;
	memberName: string;
	description: string;
	format?: string;
	details?: string;
	examples?: string[];
	guildOnly?: boolean;
	throttling?: ThrottlingOptions;
	defaultHandling?: boolean;
	args?: ArgumentInfo[];
	argsPromptLimit?: number;
	argsType?: string;
	argsCount?: number;
	argsSingleQuotes?: boolean;
	patterns?: RegExp[];
	guarded?: boolean;
};

export class BaseCommand<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public name: string;
	public aliases: string[];
	public groupID: string;
	public group?: BaseCommandGroup;
	public memberName: string;
	public description: string;
	public format: string;
	public details?: string;
	public examples?: string[];
	public guildOnly: boolean;
	public defaultHandling: boolean;
	public throttling?: ThrottlingOptions;
	public argsCollector?: BaseArgumentCollector;
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
	 * Validates the constructor parameters
	 * @param {UntitledClient} client - Client to validate
	 * @param {CommandInfo} info - Info to validate
	 * @private
	 */
	private static validateInfo(client: UntitledClient, info: CommandInfo) { // eslint-disable-line complexity
		if (!client) throw new Error('A client must be specified.');
		if (typeof info !== 'object') throw new TypeError('Command info must be an Object.');
		if (typeof info.name !== 'string') throw new TypeError('Command name must be a string.');
		if (info.name !== info.name.toLowerCase()) throw new Error('Command name must be lowercase.');
		if (info.aliases && (!Array.isArray(info.aliases) || info.aliases.some((ali: string) => typeof ali !== 'string'))) {
			throw new TypeError('Command aliases must be an Array of strings.');
		}
		if (info.aliases && info.aliases.some((ali: string) => ali !== ali.toLowerCase())) {
			throw new Error('Command aliases must be lowercase.');
		}
		if (typeof info.group !== 'string') throw new TypeError('Command group must be a string.');
		if (info.group !== info.group.toLowerCase()) throw new Error('Command group must be lowercase.');
		if (typeof info.memberName !== 'string') throw new TypeError('Command memberName must be a string.');
		if (info.memberName !== info.memberName.toLowerCase()) throw new Error('Command memberName must be lowercase.');
		if (typeof info.description !== 'string') throw new TypeError('Command description must be a string.');
		if ('format' in info && typeof info.format !== 'string') throw new TypeError('Command format must be a string.');
		if ('details' in info && typeof info.details !== 'string') throw new TypeError('Command details must be a string.');
		if (info.examples && (!Array.isArray(info.examples) || info.examples.some((ex: string) => typeof ex !== 'string'))) {
			throw new TypeError('Command examples must be an Array of strings.');
		}
		if (info.throttling) {
			if (typeof info.throttling !== 'object') throw new TypeError('Command throttling must be an Object.');
			if (typeof info.throttling.usages !== 'number' || isNaN(info.throttling.usages)) {
				throw new TypeError('Command throttling usages must be a number.');
			}
			if (info.throttling.usages < 1) throw new RangeError('Command throttling usages must be at least 1.');
			if (typeof info.throttling.duration !== 'number' || isNaN(info.throttling.duration)) {
				throw new TypeError('Command throttling duration must be a number.');
			}
			if (info.throttling.duration < 1) throw new RangeError('Command throttling duration must be at least 1.');
		}
		if (info.args && !Array.isArray(info.args)) throw new TypeError('Command args must be an Array.');
		if ('argsPromptLimit' in info && typeof info.argsPromptLimit !== 'number') {
			throw new TypeError('Command argsPromptLimit must be a number.');
		}
		if ('argsPromptLimit' in info && info.argsPromptLimit < 0) {
			throw new RangeError('Command argsPromptLimit must be at least 0.');
		}
		if (info.argsType && !['single', 'multiple'].includes(info.argsType)) {
			throw new RangeError('Command argsType must be one of "single" or "multiple".');
		}
		if (info.argsType === 'multiple' && info.argsCount && info.argsCount < 2) {
			throw new RangeError('Command argsCount must be at least 2.');
		}
		if (info.patterns && (!Array.isArray(info.patterns) || info.patterns.some((pat: RegExp) => !(pat instanceof RegExp)))) {
			throw new TypeError('Command patterns must be an Array of regular expressions.');
		}
	}

	/**
	 * @param {UntitledClient} client - The client the command is for
	 * @param {CommandInfo} info - The command information
	 */
	public constructor(client: UntitledClient, info: CommandInfo) {
		(this.constructor as typeof BaseCommand).validateInfo(client, info);

		/**
		 * Client that this command is for
		 * @name BaseCommand#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = null;

		/**
		 * Name of this command
		 * @type {string}
		 */
		this.name = info.name;

		/**
		 * Aliases for this command
		 * @type {string[]}
		 */
		this.aliases = info.aliases || [];
		if (typeof info.autoAliases === 'undefined' || info.autoAliases) {
			if (this.name.includes('-')) this.aliases.push(this.name.replace(/-/g, ''));
			for (const alias of this.aliases) {
				if (alias.includes('-')) this.aliases.push(alias.replace(/-/g, ''));
			}
		}

		/**
		 * ID of the group the command belongs to
		 * @type {string}
		 */
		this.groupID = info.group;

		/**
		 * The group the command belongs to, assigned upon registration
		 * @type {?BaseCommandGroup}
		 */
		this.group = null;

		/**
		 * Name of the command within the group
		 * @type {string}
		 */
		this.memberName = info.memberName;

		/**
		 * Short description of the command
		 * @type {string}
		 */
		this.description = info.description;

		/**
		 * Usage format string of the command
		 * @type {string}
		 */
		this.format = info.format || null;

		/**
		 * Long description of the command
		 * @type {?string}
		 */
		this.details = info.details || null;

		/**
		 * Example usage strings
		 * @type {?string[]}
		 */
		this.examples = info.examples || null;

		/**
		 * Whether the command can only be run in a guild channel
		 * @type {boolean}
		 */
		this.guildOnly = !!info.guildOnly;

		/**
		 * Whether the default command handling is enabled for the command
		 * @type {boolean}
		 */
		this.defaultHandling = 'defaultHandling' in info ? info.defaultHandling : true;

		/**
		 * Options for throttling command usages
		 * @type {?ThrottlingOptions}
		 */
		this.throttling = info.throttling || null;

		/**
		 * The argument collector for the command
		 * @type {?BaseArgumentCollector}
		 */
		this.argsCollector = info.args ? new BaseArgumentCollector(info.args, info.argsPromptLimit) : null;
		if (this.argsCollector && typeof info.format === 'undefined') {
			this.format = this.argsCollector.args.reduce((prev, arg) => {
				const wrapL: string = arg.default !== null ? '[' : '<';
				const wrapR: string = arg.default !== null ? ']' : '>';
				return `${prev}${prev ? ' ' : ''}${wrapL}${arg.label}${arg.infinite ? '...' : ''}${wrapR}`;
			}, '');
		}

		/**
		 * How the arguments are split when passed to the command's run method
		 * @type {string}
		 */
		this.argsType = info.argsType || 'single';

		/**
		 * Maximum number of arguments that will be split
		 * @type {number}
		 */
		this.argsCount = info.argsCount || 0;

		/**
		 * Whether single quotes are allowed to encapsulate an argument
		 * @type {boolean}
		 */
		this.argsSingleQuotes = 'argsSingleQuotes' in info ? info.argsSingleQuotes : true;

		/**
		 * Regular expression triggers
		 * @type {RegExp[]}
		 */
		this.patterns = info.patterns || null;

		/**
		 * Whether the command is protected from being disabled
		 * @type {boolean}
		 */
		this.guarded = Boolean(info.guarded);

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
	 * If args is specified on the command, thise will be the argument values object. If argsType is single, then only
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
	public setEnabledIn(guild: GuildResolvable, enabled: boolean) {
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
		guild = (this as any).client.resolver.resolveGuild(guild);
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
