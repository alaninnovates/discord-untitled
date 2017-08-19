import { UntitledClient, BaseCommand, BaseArgument, CommandFormatError, FriendlyError } from '../';
import { GuildExtension } from '../extensions/GuildExtension';
import { UntitledClientOptions, Throttle, ArgumentCollectorResult } from '../types';
import {
	Channel,
	Collection,
	DMChannel,
	Emoji,
	GroupDMChannel,
	Guild,
	GuildMember,
	Message,
	MessageAttachment,
	MessageEmbed,
	MessageOptions,
	MessageReaction,
	ReactionEmoji,
	StringResolvable,
	Snowflake,
	TextChannel,
	User,
	Util,
	Webhook,
	SplitOptions
} from 'discord.js';
import { stripIndents, oneLine } from 'common-tags';

export type RespondOptions = {
	type: string;
	content: string | string[];
	options?: MessageOptions;
	lang?: string;
	fromEdit?: boolean;
};

export type EditResponseOptions = {
	type: string;
	content: string | string[];
	options?: MessageOptions;
};

export class BaseMessage<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public message: Message;
	public command?: BaseCommand;
	public argString?: string;
	public patternMatches?: string[];
	public responses?: { [index: string]: Message[] };
	public responsePositions?: { [index: string]: number };

	/**
	 * Parses an argument string into an array of arguments
	 * @param {string} argString - The argument string to parse
	 * @param {number} [argCount] - The number of arguments to extract from the string
	 * @param {boolean} [allowSingleQuote=true] - Whether or not single quotes should be allowed to wrap arguments,
	 * in addition to double quotes
	 * @return {string[]} The array of arguments
	 */
	public static parseArgs(argString: string, argCount: number, allowSingleQuote: boolean = true): string[] {
		const re: RegExp = allowSingleQuote ? /\s*(?:("|')([^]*?)\1|(\S+))\s*/g : /\s*(?:(")([^]*?)"|(\S+))\s*/g;
		const result: string[] = [];
		let match: string[] = [];
		// Large enough to get all items
		argCount = argCount || argString.length;
		// Get match and push the capture group that is not null to the result
		while (--argCount && (match = re.exec(argString))) result.push(match[2] || match[3]);
		// If text remains, push it to the array as-is (except for wrapping quotes, which are removed)
		if (match && re.lastIndex < argString.length) {
			const re2: RegExp = allowSingleQuote ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g;
			result.push(argString.substr(re.lastIndex).replace(re2, '$2'));
		}
		return result;
	}

	/**
	 * @param {Message} message - Message that triggers the command
	 * @param {Command} [command] - Command the message triggers
	 * @param {string} [argString] - Argument string for the command
	 * @param {?Array<string>} [patternMatches] - Command pattern matches (if from a pattern trigger)
	 */
	public constructor(client: T, message: Message, command: BaseCommand = null, argString: string = null, patternMatches: string[] = null) {
		/**
		 * Client that the message was sent from
		 * @name BaseMessage#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = client;

		/**
		 * Message that triggers the command
		 * @type {Message}
		 */
		this.message = message;

		/**
		 * Command that the message triggers, if any
		 * @type {?Command}
		 */
		this.command = command;

		/**
		 * Argument string for the command
		 * @type {?string}
		 */
		this.argString = argString;

		/**
		 * Pattern matches (if from a pattern trigger)
		 * @type {?string[]}
		 */
		this.patternMatches = patternMatches;

		/**
		 * Response messages sent, mapped by channel ID (set by the dispatcher after running the command)
		 * @type {?Object}
		 */
		this.responses = null;

		/**
		 * The index of the current response that will be edited, mapped by channel ID
		 * @type {?Object}
		 */
		this.responsePositions = null;
	}

	/**
	 * Creates a usage string for the message's command
	 * @param {string} [argString] - A string of arguments for the command
	 * @param {string} [prefix=this.message.guild.commandPrefix || this.client.commandPrefix] - Prefix to use for the
	 * prefixed command format
	 * @param {User} [user=this.client.user] - User to use for the mention command format
	 * @return {string}
	 */
	public usage(argString: string, prefix: string, user: User = this.client.user): string {
		if (typeof prefix === 'undefined') {
			if (this.message.guild) prefix = (this.message.guild as GuildExtension).commandPrefix;
			else prefix = this.client.commandPrefix;
		}
		return this.command.usage(argString, prefix, user);
	}

	/**
	 * Creates a usage string for any command
	 * @param {string} [command] - A command + arg string
	 * @param {string} [prefix=this.message.guild.commandPrefix || this.client.commandPrefix] - Prefix to use for the
	 * prefixed command format
	 * @param {User} [user=this.client.user] - User to use for the mention command format
	 * @return {string}
	 */
	public anyUsage(command?: string, prefix?: string, user: User = this.client.user): string {
		if (typeof prefix === 'undefined') {
			if (this.message.guild) prefix = (this.message.guild as GuildExtension).commandPrefix;
			else prefix = this.client.commandPrefix;
		}
		return BaseCommand.usage(command, prefix, user);
	}

	/**
	 * Parses the argString into usable arguments, based on the argsType and argsCount of the command
	 * @return {string|string[]}
	 * @see {@link Command#run}
	 */
	public parseArgs(): string | string[] {
		switch (this.command.argsType) {
			case 'single':
				return this.argString.trim().replace(
					this.command.argsSingleQuotes ? /^("|')([^]*)\1$/g : /^(")([^]*)"$/g, '$2'
				);
			case 'multiple':
				return (this.constructor as typeof BaseMessage).parseArgs(this.argString, this.command.argsCount, this.command.argsSingleQuotes);
			default:
				throw new RangeError(`Unknown argsType "${this.command.argsType}".`);
		}
	}

	/**
	 * Runs the command
	 * @return {Promise<?Message|?Array<Message>>}
	 */
	public async run(): Promise<Message | Message[]> { // eslint-disable-line complexity
		// Obtain the member if we don't have it (ugly-ass if statement ahead)
		if (this.message.channel.type === 'text' && !this.message.guild.members.has(this.message.author.id) &&
			!this.message.webhookID) {
			this.message.member = await this.message.guild.fetchMember(this.message.author);
		}

		// Make sure the command is usable in this context
		if (this.command.guildOnly && !this.message.guild) {
			/**
			 * Emitted when a command is prevented from running
			 * @event UntitledClient#commandBlocked
			 * @param {BaseMessage} message - Command message that the command is running from
			 * @param {string} reason - Reason that the command was blocked
			 * (built-in reasons are `guildOnly`, `permission`, and `throttling`)
			 */
			this.client.emit('commandBlocked', this, 'guildOnly');
			return this.reply(`The \`${this.command.name}\` command must be used in a server channel.`);
		}

		// Ensure the user has permission to use the command
		const hasPermission: string | boolean = this.command.hasPermission(this);
		if (!hasPermission || typeof hasPermission === 'string') {
			this.client.emit('commandBlocked', this, 'permission');
			if (typeof hasPermission === 'string') return this.reply(hasPermission);
			else return this.reply(`You do not have permission to use the \`${this.command.name}\` command.`);
		}

		// Throttle the command
		const throttle: Throttle = this.command.throttle(this.message.author.id);
		if (throttle && throttle.usages + 1 > this.command.throttling.usages) {
			const remaining: number = (throttle.start + (this.command.throttling.duration * 1000) - Date.now()) / 1000;
			this.client.emit('commandBlocked', this, 'throttling');
			return this.reply(
				`You may not use the \`${this.command.name}\` command again for another ${remaining.toFixed(1)} seconds.`
			);
		}

		// Figure out the command arguments
		let args: string | string[] = this.patternMatches;
		if (!args && this.command.argsCollector) {
			const collArgs: BaseArgument[] = this.command.argsCollector.args;
			const count: number = collArgs[collArgs.length - 1].infinite ? Infinity : collArgs.length;
			const provided: string[] = (this.constructor as typeof BaseMessage).parseArgs(this.argString.trim(), count, this.command.argsSingleQuotes);

			const result: ArgumentCollectorResult = await this.command.argsCollector.obtain(this, provided);
			if (result.cancelled) {
				if (result.prompts.length === 0) {
					const err: CommandFormatError = new CommandFormatError(this);
					return this.reply(err.message);
				}
				return this.reply('Cancelled command.');
			}
			args = result.values;
		}
		if (!args) args = this.parseArgs();
		const fromPattern = Boolean(this.patternMatches);

		// Run the command
		if (throttle) throttle.usages++;
		const typingCount: number = this.message.channel.typingCount;
		try {
			this.client.emit('debug', `Running command ${this.command.groupID}:${this.command.memberName}.`);
			const promise: Promise<Message | Message[]> = this.command.run(this, args, fromPattern);
			/**
			 * Emitted when running a command
			 * @event UntitledClient#commandRun
			 * @param {BaseCommand} command - Command that is being run
			 * @param {Promise} promise - Promise for the command result
			 * @param {BaseMessage} message - Command message that the command is running from (see {@link Command#run})
			 * @param {Object|string|string[]} args - Arguments for the command (see {@link Command#run})
			 * @param {boolean} fromPattern - Whether the args are pattern matches (see {@link Command#run})
			 */
			this.client.emit('commandRun', this.command, promise, this, args, fromPattern);
			const retVal: Message | Message[] = await promise;
			if (!(retVal instanceof Message || retVal instanceof Array || retVal === null || retVal === undefined)) {
				throw new TypeError(oneLine`
					Command ${this.command.name}'s run() resolved with an unknown type
					(${retVal !== null ? retVal && (retVal as typeof Message).constructor ? (retVal as typeof Message).constructor.name : typeof retVal : null}).
					Command run methods must return a Promise that resolve with a Message, Array of Messages, or null/undefined.
				`);
			}
			return retVal;
		} catch (err) {
			/**
			 * Emitted when a command produces an error while running
			 * @event UntitledClient#commandError
			 * @param {BaseCommand} command - Command that produced an error
			 * @param {Error} err - Error that was thrown
			 * @param {BaseMessage} message - Command message that the command is running from (see {@link Command#run})
			 * @param {Object|string|string[]} args - Arguments for the command (see {@link Command#run})
			 * @param {boolean} fromPattern - Whether the args are pattern matches (see {@link Command#run})
			 */
			this.client.emit('commandError', this.command, err, this, args, fromPattern);
			if (this.message.channel.typingCount > typingCount) this.message.channel.stopTyping();
			if (err instanceof FriendlyError) {
				return this.reply(err.message);
			} else {
				const owners: User[] = this.client.owners;
				const ownerList: string = owners ? owners.map((usr: User, i: number) => {
					const or: string = i === owners.length - 1 && owners.length > 1 ? 'or ' : '';
					return `${or}${Util.escapeMarkdown(usr.username)}#${usr.discriminator}`;
				}).join(owners.length > 2 ? ', ' : ' ') : '';

				const invite: string = this.client.options.invite;
				return this.reply(stripIndents`
					An error occurred while running the command: \`${err.name}: ${err.message}\`
					You shouldn't ever receive an error like this.
					Please contact ${ownerList || 'the bot owner'}${invite ? ` in this server: ${invite}` : '.'}
				`);
			}
		}
	}

	/**
	 * Responds to the command message
	 * @param {Object} [options] - Options for the response
	 * @return {Message|Message[]}
	 * @private
	 */
	private async respond({ type = 'reply', content, options, lang, fromEdit = false }: RespondOptions): Promise<Message | Message[]> {
		const shouldEdit: boolean = this.responses && !fromEdit;
		if (shouldEdit) {
			if (options && options.split && typeof options.split !== 'object') options.split = {};
		}

		if (type === 'reply' && this.message.channel.type === 'dm') type = 'plain';
		if (type !== 'direct') {
			if (this.message.guild && !(this.message.channel as TextChannel).permissionsFor(this.client.user).has('SEND_MESSAGES')) {
				type = 'direct';
			}
		}

		content = Util.resolveString(content);
		let split: SplitOptions;
		if (options && options.split) split = (options.split as SplitOptions) || {};

		switch (type) {
			case 'plain':
				if (!shouldEdit) return this.message.channel.send(content, options);
				return this.editCurrentResponse(channelIDOrDM(this.message.channel), { type, content, options });
			case 'reply':
				if (!shouldEdit) return this.message.reply(content, options);
				if (options && options.split && !split.prepend) split.prepend = `${this.message.author}, `;
				return this.editCurrentResponse(channelIDOrDM(this.message.channel), { type, content, options });
			case 'direct':
				if (!shouldEdit) return this.message.author.send(content, options);
				return this.editCurrentResponse('dm', { type, content, options });
			case 'code':
				if (!shouldEdit) return this.message.channel.send(content, options);
				if (options && options.split) {
					if (!split.prepend) split.prepend = `\`\`\`${lang || ''}\n`;
					if (!split.append) split.append = '\n```';
				}
				content = `\`\`\`${lang || ''}\n${Util.escapeMarkdown((content as string), true)}\n\`\`\``;
				return this.editCurrentResponse(channelIDOrDM(this.message.channel), { type, content, options });
			default:
				throw new RangeError(`Unknown response type "${type}".`);
		}
	}

	/**
	 * Edits a response to the command message
	 * @param {Message|Message[]} response - The response message(s) to edit
	 * @param {Object} [options] - Options for the response
	 * @return {Promise<Message|Message[]>}
	 * @private
	 */
	private editResponse(response: Message | Message[], { type, content, options }: EditResponseOptions): Promise<Message | Message[]> {
		if (!response) return this.respond({ type, content, options, fromEdit: true });
		if (options && options.split) content = Util.splitMessage((content as string), (options.split as SplitOptions));

		let prepend = '';
		if (type === 'reply') prepend = `${this.message.author}, `;

		if (content instanceof Array) {
			const promises: Promise<Message>[] = [];
			if (response instanceof Array) {
				for (let i = 0; i < content.length; i++) {
					if (response.length > i) promises.push(response[i].edit(`${prepend}${content[i]}`, options));
					else promises.push((response[0].channel.send(`${prepend}${content[i]}`) as Promise<Message>));
				}
			} else {
				promises.push(response.edit(`${prepend}${content[0]}`, options));
				for (let i = 1; i < content.length; i++) {
					promises.push((response.channel.send(`${prepend}${content[i]}`) as Promise<Message>));
				}
			}
			return Promise.all(promises);
		} else {
			if (response instanceof Array) {
				for (let i = response.length - 1; i > 0; i--) response[i].delete();
				return response[0].edit(`${prepend}${content}`, options);
			} else {
				return response.edit(`${prepend}${content}`, options);
			}
		}
	}

	/**
	 * Edits the current response
	 * @param {string} id - The ID of the channel the response is in ("DM" for direct messages)
	 * @param {Object} [options] - Options for the response
	 * @return {Promise<Message|Message[]>}
	 * @private
	 */
	private editCurrentResponse(id: Snowflake, options: any): Promise<Message | Message[]> {
		if (typeof this.responses[id] === 'undefined') this.responses[id] = [];
		if (typeof this.responsePositions[id] === 'undefined') this.responsePositions[id] = -1;
		this.responsePositions[id]++;
		return this.editResponse(this.responses[id][this.responsePositions[id]], options);
	}

	/**
	 * Responds with a plain message
	 * @param {StringResolvable} content - Content for the message
	 * @param {MessageOptions} [options] - Options for the message
	 * @return {Promise<Message|Message[]>}
	 */
	public say(content: StringResolvable, options?: MessageOptions): Promise<Message | Message[]> {
		if (!options && typeof content === 'object' && !(content instanceof Array)) {
			options = content;
			content = '';
		}
		return this.respond({ type: 'plain', content, options });
	}

	/**
	 * Responds with a reply message
	 * @param {StringResolvable} content - Content for the message
	 * @param {MessageOptions} [options] - Options for the message
	 * @return {Promise<Message|Message[]>}
	 */
	public reply(content: StringResolvable, options?: MessageOptions): Promise<Message | Message[]> {
		if (!options && typeof content === 'object' && !(content instanceof Array)) {
			options = content;
			content = '';
		}
		return this.respond({ type: 'reply', content, options });
	}

	/**
	 * Responds with a direct message
	 * @param {StringResolvable} content - Content for the message
	 * @param {MessageOptions} [options] - Options for the message
	 * @return {Promise<Message|Message[]>}
	 */
	public direct(content: StringResolvable, options?: MessageOptions): Promise<Message | Message[]> {
		if (!options && typeof content === 'object' && !(content instanceof Array)) {
			options = content;
			content = '';
		}
		return this.respond({ type: 'direct', content, options });
	}

	/**
	 * Responds with a code message
	 * @param {string} lang - Language for the code block
	 * @param {StringResolvable} content - Content for the message
	 * @param {MessageOptions} [options] - Options for the message
	 * @return {Promise<Message|Message[]>}
	 */
	public code(lang: string, content: StringResolvable, options?: MessageOptions): Promise<Message | Message[]> {
		if (!options && typeof content === 'object' && !(content instanceof Array)) {
			options = content;
			content = '';
		}
		if (typeof options !== 'object') options = {};
		options.code = lang;
		return this.respond({ type: 'code', content, options });
	}

	/**
	 * Responds with an embed
	 * @param {MessageEmbed|Object} embed - Embed to send
	 * @param {StringResolvable} [content] - Content for the message
	 * @param {MessageOptions} [options] - Options for the message
	 * @return {Promise<Message|Message[]>}
	 */
	public embed(embed: object, content: StringResolvable = '', options?: MessageOptions): Promise<Message | Message[]> {
		if (typeof options !== 'object') options = {};
		options.embed = embed;
		return this.respond({ type: 'plain', content, options });
	}

	/**
	 * Responds with a mention + embed
	 * @param {MessageEmbed|Object} embed - Embed to send
	 * @param {StringResolvable} [content] - Content for the message
	 * @param {MessageOptions} [options] - Options for the message
	 * @return {Promise<Message|Message[]>}
	 */
	public replyEmbed(embed: object, content: StringResolvable = '', options?: MessageOptions): Promise<Message | Message[]> {
		if (typeof options !== 'object') options = {};
		options.embed = embed;
		return this.respond({ type: 'reply', content, options });
	}

	/**
	 * Finalizes the command message by setting the responses and deleting any remaining prior ones
	 * @param {?Array<Message|Message[]>} responses - Responses to the message
	 */
	public finalize(responses: Message | Message[]) {
		if (this.responses) this.deleteRemainingResponses();
		this.responses = {};
		this.responsePositions = {};

		if (responses instanceof Array) {
			for (const response of responses) {
				const channel = (response instanceof Array ? response[0] : response).channel;
				const id = channelIDOrDM(channel);
				if (!this.responses[id]) {
					this.responses[id] = [];
					this.responsePositions[id] = -1;
				}
				this.responses[id].push(response);
			}
		} else if (responses) {
			const id = channelIDOrDM(responses.channel);
			this.responses[id] = [responses];
			this.responsePositions[id] = -1;
		}
	}

	/**
	 * Deletes any prior responses that haven't been updated
	 * @private
	 */
	private deleteRemainingResponses() {
		for (const id of Object.keys(this.responses)) {
			const responses: Message[] = this.responses[id];
			for (let i = this.responsePositions[id] + 1; i < responses.length; i++) {
				const response: Message = responses[i];
				if (response instanceof Array) {
					for (const resp of (response as Message[])) resp.delete();
				} else {
					response.delete();
				}
			}
		}
	}

	/* -------------------------------------------------------------------------------------------- *\
	|*                                          SHORTCUTS                                           *|
	|*                          Rest not, and beware, for here be dragons.                          *|
	|* Below these lines lie the fabled message method/getter shortcuts for ye olde lazy developer. *|
	\* -------------------------------------------------------------------------------------------- */

	/**
	 * Shortcut to `this.message.id`
	 * @type {Snowflake}
	 * @see {@link Message#id}
	 * @readonly
	 */
	public get id(): Snowflake {
		return this.message.id;
	}

	/**
	 * Shortcut to `this.message.content`
	 * @type {string}
	 * @see {@link Message#content}
	 * @readonly
	 */
	public get content(): string {
		return this.message.content;
	}

	/**
	 * Shortcut to `this.message.author`
	 * @type {User}
	 * @see {@link Message#author}
	 * @readonly
	 */
	public get author(): User {
		return this.message.author;
	}

	/**
	 * Shortcut to `this.message.channel`
	 * @type {TextChannel|DMChannel|GroupDMChannel}
	 * @see {@link Message#channel}
	 * @readonly
	 */
	public get channel(): TextChannel | DMChannel | GroupDMChannel {
		return this.message.channel;
	}

	/**
	 * Shortcut to `this.message.guild`
	 * @type {?Guild}
	 * @see {@link Message#guild}
	 * @readonly
	 */
	public get guild(): Guild {
		return this.message.guild;
	}

	/**
	 * Shortcut to `this.message.member`
	 * @type {?GuildMember}
	 * @see {@link Message#member}
	 * @readonly
	 */
	public get member(): GuildMember {
		return this.message.member;
	}

	/**
	 * Shortcut to `this.message.pinned`
	 * @type {boolean}
	 * @see {@link Message#pinned}
	 * @readonly
	 */
	public get pinned(): boolean {
		return this.message.pinned;
	}

	/**
	 * Shortcut to `this.message.tts`
	 * @type {boolean}
	 * @see {@link Message#tts}
	 * @readonly
	 */
	public get tts(): boolean {
		return this.message.tts;
	}

	/**
	 * Shortcut to `this.message.nonce`
	 * @type {string}
	 * @see {@link Message#nonce}
	 * @readonly
	 */
	public get nonce(): string {
		return this.message.nonce;
	}

	/**
	 * Shortcut to `this.message.system`
	 * @type {boolean}
	 * @see {@link Message#system}
	 * @readonly
	 */
	public get system(): boolean {
		return this.message.system;
	}

	/**
	 * Shortcut to `this.message.embeds`
	 * @type {MessageEmbed[]}
	 * @see {@link Message#embeds}
	 * @readonly
	 */
	public get embeds(): MessageEmbed[] {
		return this.message.embeds;
	}

	/**
	 * Shortcut to `this.message.attachments`
	 * @type {Collection<string, MessageAttachment>}
	 * @see {@link Message#attachments}
	 * @readonly
	 */
	public get attachments(): Collection<string, MessageAttachment> {
		return this.message.attachments;
	}

	/**
	 * Shortcut to `this.message.reactions`
	 * @type {Collection<string, MessageReaction>}
	 * @see {@link Message#reactions}
	 * @readonly
	 */
	public get reactions(): Collection<string, MessageReaction> {
		return this.message.reactions;
	}

	/**
	 * Shortcut to `this.message.createdTimestamp`
	 * @type {number}
	 * @see {@link Message#createdTimestamp}
	 * @readonly
	 */
	public get createdTimestamp(): number {
		return this.message.createdTimestamp;
	}

	/**
	 * Shortcut to `this.message.createdAt`
	 * @type {Date}
	 * @see {@link Message#createdAt}
	 * @readonly
	 */
	public get createdAt(): Date {
		return this.message.createdAt;
	}

	/**
	 * Shortcut to `this.message.editedTimestamp`
	 * @type {number}
	 * @see {@link Message#editedTimestamp}
	 * @readonly
	 */
	public get editedTimestamp(): number {
		return this.message.editedTimestamp;
	}

	/**
	 * Shortcut to `this.message.editedAt`
	 * @type {Date}
	 * @see {@link Message#editedAt}
	 * @readonly
	 */
	public get editedAt(): Date {
		return this.message.editedAt;
	}

	/**
	 * Shortcut to `this.message.mentions`
	 * @type {Object}
	 * @see {@link Message#mentions}
	 * @readonly
	 */
	public get mentions(): object {
		return this.message.mentions;
	}

	/**
	 * Shortcut to `this.message.webhookID`
	 * @type {?Snowflake}
	 * @see {@link Message#webhookID}
	 * @readonly
	 */
	public get webhookID(): Snowflake {
		return this.message.webhookID;
	}

	/**
	 * Shortcut to `this.message.cleanContent`
	 * @type {string}
	 * @see {@link Message#cleanContent}
	 * @readonly
	 */
	public get cleanContent(): string {
		return this.message.cleanContent;
	}

	/**
	 * Shortcut to `this.message.edits`
	 * @type {Message[]}
	 * @see {@link Message#edits}
	 * @readonly
	 */
	public get edits(): Message[] {
		return this.message.edits;
	}

	/**
	 * Shortcut to `this.message.editable`
	 * @type {boolean}
	 * @see {@link Message#editable}
	 * @readonly
	 */
	public get editable(): boolean {
		return this.message.editable;
	}

	/**
	 * Shortcut to `this.message.deletable`
	 * @type {boolean}
	 * @see {@link Message#deletable}
	 * @readonly
	 */
	public get deletable(): boolean {
		return this.message.deletable;
	}

	/**
	 * Shortcut to `this.message.pinnable`
	 * @type {boolean}
	 * @see {@link Message#pinnable}
	 * @readonly
	 */
	public get pinnable(): boolean {
		return this.message.pinnable;
	}

	/**
	 * Shortcut to `this.message.edit(content)`
	 * @param {StringResolvable} content - New content for the message
	 * @param {MessageEditOptions} options - The options to provide
	 * @returns {Promise<Message>}
	 * @see {@link Message#edit}
	 * @readonly
	 */
	public edit(content: StringResolvable, options?: MessageOptions): Promise<Message> {
		return this.message.edit(content, options);
	}

	/**
	 * Shortcut to `this.message.editCode(content)`
	 * @param {string} lang - Language for the code block
	 * @param {StringResolvable} content - New content for the message
	 * @returns {Promise<Message>}
	 * @see {@link Message#editCode}
	 * @readonly
	 */
	public editCode(lang: string, content: StringResolvable) {
		return this.message.editCode(lang, content);
	}

	/**
	 * Shortcut to `this.message.react()`
	 * @param {string|Emoji|ReactionEmoji} emoji - Emoji to react with
	 * @returns {Promise<MessageReaction>}
	 * @see {@link Message#react}
	 * @readonly
	 */
	public react(emoji: string | Emoji | ReactionEmoji): Promise<MessageReaction> {
		return this.message.react(emoji);
	}

	/**
	 * Shortcut to `this.message.clearReactions()`
	 * @returns {Promise<Message>}
	 * @see {@link Message#clearReactions}
	 * @readonly
	 */
	public clearReactions(): Promise<Message> {
		return this.message.clearReactions();
	}

	/**
	 * Shortcut to `this.message.pin()`
	 * @returns {Promise<Message>}
	 * @see {@link Message#pin}
	 * @readonly
	 */
	public pin(): Promise<Message> {
		return this.message.pin();
	}

	/**
	 * Shortcut to `this.message.unpin()`
	 * @returns {Promise<Message>}
	 * @see {@link Message#unpin}
	 * @readonly
	 */
	public unpin(): Promise<Message> {
		return this.message.unpin();
	}

	/**
	 * Shortcut to `this.message.delete()`
	 * @param {number} [timeout=0] - How long to wait to delete the message in milliseconds
	 * @returns {Promise<Message>}
	 * @see {@link Message#delete}
	 * @readonly
	 */
	public delete(timeout: number): Promise<Message> {
		return this.message.delete(timeout);
	}

	/**
	 * Shortcut to `this.message.fetchWebhook()`
	 * @returns {Promise<?Webhook>}
	 * @see {@link Message#fetchWebhook}
	 * @readonly
	 */
	public fetchWebhook(): Promise<Webhook> {
		return this.message.fetchWebhook();
	}
}

function channelIDOrDM(channel: Channel) {
	if (channel.type !== 'dm') return channel.id;
	return 'dm';
}
