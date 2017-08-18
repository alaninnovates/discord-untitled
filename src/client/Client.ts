import {
	BaseArgumentType,
	BaseMessage,
	BaseCommand,
	BaseCommandGroup,
	BaseSettingProvider
} from '../';
import { CommandRegistry } from './Registry';
import { CommandDispatcher } from './Dispatcher';
import { GuildSettingsHelper } from '../providers/GuildSettingsHelper';
import {
	Client,
	ClientOptions,
	ClientUserSettings,
	Collection,
	Emoji,
	Channel,
	Guild,
	GuildMember,
	Message,
	MessageReaction,
	Role,
	Snowflake,
	User,
	UserResolvable
} from 'discord.js';

export type UntitledClientOptions = {
	selfbot?: boolean;
	commandPrefix?: string;
	commandEditableDuration?: number;
	nonCommandEditable?: boolean;
	unknownCommandResponse?: boolean;
	owner?: string | string[] | Set<string>;
	invite?: string;
} & ClientOptions;

export class UntitledClient extends Client {
	public options: UntitledClientOptions;
	public registry: CommandRegistry;
	public dispatcher: CommandDispatcher;
	public provider: BaseSettingProvider;
	public settings: GuildSettingsHelper;
	public _commandPrefix: string;

	/**
	 * @param {UntitledClientOptions} [options] - Options for the client
	 */
	public constructor(options: UntitledClientOptions = {}) {
		if (typeof options.selfbot === 'undefined') options.selfbot = false;
		if (typeof options.commandPrefix === 'undefined') options.commandPrefix = '!';
		if (options.commandPrefix === null) options.commandPrefix = '';
		if (typeof options.commandEditableDuration === 'undefined') options.commandEditableDuration = 30;
		if (typeof options.nonCommandEditable === 'undefined') options.nonCommandEditable = true;
		if (typeof options.unknownCommandResponse === 'undefined') options.unknownCommandResponse = true;
		super(options);

		/**
		 * The client's command registry
		 * @type {CommandRegistry}
		 */
		this.registry = new CommandRegistry(this);

		/**
		 * The client's command dispatcher
		 * @type {CommandDispatcher}
		 */
		this.dispatcher = new CommandDispatcher(this, this.registry);

		/**
		 * The client's setting provider
		 * @type {?BaseSettingProvider}
		 */
		this.provider = null;

		/**
		 * Shortcut to use setting provider methods for the global settings
		 * @type {GuildSettingsHelper}
		 */
		this.settings = new GuildSettingsHelper(this, null);

		/**
		 * Internal global command prefix, controlled by the {@link UntitledClient#commandPrefix} getter/setter
		 * @type {?string}
		 * @private
		 */
		this._commandPrefix = null;

		const msgErr: ((err: Error) => boolean) = (err: Error) => this.emit('error', err);
		this.on('message', (message: Message) => this.dispatcher.handleMessage(message).catch(msgErr));
		this.on('messageUpdate', (oldMessage: Message, newMessage: Message) => this.dispatcher.handleMessage(newMessage, oldMessage).catch(msgErr));

		if (options.owner) {
			this.once('ready', () => {
				if (options.owner instanceof Array || options.owner instanceof Set) {
					for (const owner of options.owner) {
						this.fetchUser(owner).catch((err: Error) => {
							this.emit('warn', `Unable to fetch owner ${owner}.`);
							this.emit('error', err);
						});
					}
				} else {
					this.fetchUser(options.owner).catch((err: Error) => {
						this.emit('warn', `Unable to fetch owner ${options.owner}.`);
						this.emit('error', err);
					});
				}
			});
		}
	}

	/**
	 * Global command prefix. An empty string indicates that there is no default prefix, and only mentions will be used.
	 * Setting to `null` means that the default prefix from {@link UntitledClient#options} will be used instead.
	 * @type {string}
	 * @emits {@link UntitledClient#commandPrefixChange}
	 */
	public get commandPrefix(): string {
		if (typeof this._commandPrefix === 'undefined' || this._commandPrefix === null) return this.options.commandPrefix;
		return this._commandPrefix;
	}

	public set commandPrefix(prefix: string) {
		this._commandPrefix = prefix;
		this.emit('commandPrefixChange', null, this._commandPrefix);
	}

	/**
	 * Owners of the bot, set by the {@link UntitledOptions#owner} option
	 * <info>If you simply need to check if a user is an owner of the bot, please instead use
	 * {@link UntitledClient#isOwner}.</info>
	 * @type {?Array<User>}
	 * @readonly
	 */
	public get owners(): User[] {
		if (!this.options.owner) return null;
		if (typeof this.options.owner === 'string') return [this.users.get(this.options.owner)];
		const owners: User[] = [];
		for (const owner of this.options.owner) owners.push(this.users.get(owner));
		return owners;
	}

	/**
	 * Checks whether a user is an owner of the bot (in {@link UntitledOptions#owner})
	 * @param {UserResolvable} user - User to check for ownership
	 * @return {boolean}
	 */
	public isOwner(user: UserResolvable): boolean {
		if (!this.options.owner) return false;
		user = (this as any).resolver.resolveUser(user);
		if (!user) throw new RangeError('Unable to resolve user.');
		if (typeof this.options.owner === 'string') return (user as User).id === this.options.owner;
		if (this.options.owner instanceof Array) return this.options.owner.includes((user as User).id);
		if (this.options.owner instanceof Set) return this.options.owner.has((user as User).id);
		throw new RangeError('The client\'s "owner" option is an unknown value.');
	}

	/**
	 * Sets the setting provider to use, and initialises it once the client is ready
	 * @param {BaseSettingProvider} provider Provider to use
	 * @return {Promise<void>}
	 */
	public async setProvider(provider: BaseSettingProvider): Promise<void> {
		provider = await provider;
		this.provider = provider;

		if (this.readyTimestamp) {
			this.emit('debug', `Provider set to ${provider.constructor.name} - initialising...`);
			await provider.init(this);
			this.emit('debug', 'Provider finished initialisation.');
			return undefined;
		}

		this.emit('debug', `Provider set to ${provider.constructor.name} - will initialise once ready.`);
		await new Promise(resolve => {
			this.once('ready', () => {
				this.emit('debug', `Initialising provider...`);
				resolve(provider.init(this));
			});
		});

		this.emit('debug', 'Provider finished initialisation.');
		return undefined;
	}

	public async destroy(): Promise<void> {
		super.destroy().then(() => this.provider ? this.provider.destroy() : undefined);
	}

	public on(event: 'channelCreate' | 'channelDelete', listener: (channel: Channel) => void): this;
	public on(event: 'channelPinsUpdate', listener: (channel: Channel, time: Date) => void): this;
	public on(event: 'channelUpdate', listener: (oldChannel: Channel, newChannel: Channel) => void): this;
	public on(event: 'clientUserSettingsUpdate', listener: (clientUserSettings: ClientUserSettings) => void): this;
	public on(event: 'debug' | 'warn', listener: (info: string) => void): this;
	public on(event: 'disconnect', listener: (event: any) => void): this;
	public on(event: 'emojiCreate | emojiDelete', listener: (emoji: Emoji) => void): this;
	public on(event: 'emojiUpdate', listener: (oldEmoji: Emoji, newEmoji: Emoji) => void): this;
	public on(event: 'error', listener: (error: Error) => void): this;
	public on(event: 'guildBanAdd' | 'guildBanRemove', listener: (guild: Guild, user: User) => void): this;
	public on(event: 'guildCreate' | 'guildDelete' | 'guildUnavailable', listener: (guild: Guild) => void): this;
	public on(event: 'guildMemberAdd' | 'guildMemberAvailable' | 'guildMemberRemove', listener: (member: GuildMember) => void): this;
	public on(event: 'guildMembersChunk', listener: (members: GuildMember[], guild: Guild) => void): this;
	public on(event: 'guildMemberSpeaking', listener: (member: GuildMember, speaking: boolean) => void): this;
	public on(event: 'guildMemberUpdate' | 'presenceUpdate' | 'voiceStateUpdate', listener: (oldMember: GuildMember, newMember: GuildMember) => void): this;
	public on(event: 'guildUpdate', listener: (oldGuild: Guild, newGuild: Guild) => void): this;
	public on(event: 'message' | 'messageDelete' | 'messageReactionRemoveAll', listener: (message: Message) => void): this;
	public on(event: 'messageDeleteBulk', listener: (messages: Collection<Snowflake, Message>) => void): this;
	public on(event: 'messageReactionAdd' | 'messageReactionRemove', listener: (messageReaction: MessageReaction, user: User) => void): this;
	public on(event: 'messageUpdate', listener: (oldMessage: Message, newMessage: Message) => void): this;
	public on(event: 'ready' | 'reconnecting', listener: () => void): this;
	public on(event: 'roleCreate' | 'roleDelete', listener: (role: Role) => void): this;
	public on(event: 'roleUpdate', listener: (oldRole: Role, newRole: Role) => void): this;
	public on(event: 'typingStart' | 'typingStop', listener: (channel: Channel, user: User) => void): this;
	public on(event: 'userNoteUpdate', listener: (user: UserResolvable, oldNote: string, newNote: string) => void): this;
	public on(event: 'userUpdate', listener: (oldUser: User, newUser: User) => void): this;

	public on(event: 'commandBlocked', listener: (message: BaseMessage, reason: string) => void): this;
	public on(event: 'commandError', listener: (command: BaseCommand, err: Error, message: BaseMessage, args: object | string | string[], fromPattern: boolean) => void): this;
	public on(event: 'commandPrefixChange', listener: (guild: Guild, prefix: string) => void): this;
	public on(event: 'commandRegister', listener: (command: BaseCommand, registry: CommandRegistry) => void): this;
	public on(event: 'commandReregister', listener: (newCommand: BaseCommand, oldCommand: BaseCommand) => void): this;
	// tslint:disable-next-line:max-line-length
	public on(event: 'commandRun', listener: (command: BaseCommand, promise: Promise<any>, message: BaseMessage, args: object | string | string[], fromPattern: boolean) => void): this;
	public on(event: 'commandStatusChange', listener: (guild: Guild, command: BaseCommand, enabled: boolean) => void): this;
	public on(event: 'commandUnregister', listener: (command: BaseCommand) => void): this;
	public on(event: 'groupRegister', listener: (group: BaseCommandGroup, registry: CommandRegistry) => void): this;
	public on(event: 'groupStatusChange', listener: (guild: Guild, group: BaseCommandGroup, enabled: boolean) => void): this;
	public on(event: 'typeRegister', listener: (type: BaseArgumentType, registry: CommandRegistry) => void): this;
	public on(event: 'unknownCommand', listener: (message: BaseMessage) => void): this;

	public on(event: string, listener: Function): this {
		return super.on(event, listener);
	}

	public once(event: 'channelCreate' | 'channelDelete', listener: (channel: Channel) => void): this;
	public once(event: 'channelPinsUpdate', listener: (channel: Channel, time: Date) => void): this;
	public once(event: 'channelUpdate', listener: (oldChannel: Channel, newChannel: Channel) => void): this;
	public once(event: 'clientUserSettingsUpdate', listener: (clientUserSettings: ClientUserSettings) => void): this;
	public once(event: 'debug' | 'warn', listener: (info: string) => void): this;
	public once(event: 'disconnect', listener: (event: any) => void): this;
	public once(event: 'emojiCreate | emojiDelete', listener: (emoji: Emoji) => void): this;
	public once(event: 'emojiUpdate', listener: (oldEmoji: Emoji, newEmoji: Emoji) => void): this;
	public once(event: 'error', listener: (error: Error) => void): this;
	public once(event: 'guildBanAdd' | 'guildBanRemove', listener: (guild: Guild, user: User) => void): this;
	public once(event: 'guildCreate' | 'guildDelete' | 'guildUnavailable', listener: (guild: Guild) => void): this;
	public once(event: 'guildMemberAdd' | 'guildMemberAvailable' | 'guildMemberRemove', listener: (member: GuildMember) => void): this;
	public once(event: 'guildMembersChunk', listener: (members: GuildMember[], guild: Guild) => void): this;
	public once(event: 'guildMemberSpeaking', listener: (member: GuildMember, speaking: boolean) => void): this;
	public once(event: 'guildMemberUpdate' | 'presenceUpdate' | 'voiceStateUpdate', listener: (oldMember: GuildMember, newMember: GuildMember) => void): this;
	public once(event: 'guildUpdate', listener: (oldGuild: Guild, newGuild: Guild) => void): this;
	public once(event: 'message' | 'messageDelete' | 'messageReactionRemoveAll', listener: (message: Message) => void): this;
	public once(event: 'messageDeleteBulk', listener: (messages: Collection<Snowflake, Message>) => void): this;
	public once(event: 'messageReactionAdd' | 'messageReactionRemove', listener: (messageReaction: MessageReaction, user: User) => void): this;
	public once(event: 'messageUpdate', listener: (oldMessage: Message, newMessage: Message) => void): this;
	public once(event: 'ready' | 'reconnecting', listener: () => void): this;
	public once(event: 'roleCreate' | 'roleDelete', listener: (role: Role) => void): this;
	public once(event: 'roleUpdate', listener: (oldRole: Role, newRole: Role) => void): this;
	public once(event: 'typingStart' | 'typingStop', listener: (channel: Channel, user: User) => void): this;
	public once(event: 'userNoteUpdate', listener: (user: UserResolvable, oldNote: string, newNote: string) => void): this;
	public once(event: 'userUpdate', listener: (oldUser: User, newUser: User) => void): this;

	public once(event: 'commandBlocked', listener: (message: BaseMessage, reason: string) => void): this;
	public once(event: 'commandError', listener: (command: BaseCommand, err: Error, message: BaseMessage, args: object | string | string[], fromPattern: boolean) => void): this;
	public once(event: 'commandPrefixChange', listener: (guild: Guild, prefix: string) => void): this;
	public once(event: 'commandRegister', listener: (command: BaseCommand, registry: CommandRegistry) => void): this;
	public once(event: 'commandReregister', listener: (newCommand: BaseCommand, oldCommand: BaseCommand) => void): this;
	// tslint:disable-next-line:max-line-length
	public once(event: 'commandRun', listener: (command: BaseCommand, promise: Promise<any>, message: BaseMessage, args: object | string | string[], fromPattern: boolean) => void): this;
	public once(event: 'commandStatusChange', listener: (guild: Guild, command: BaseCommand, enabled: boolean) => void): this;
	public once(event: 'commandUnregister', listener: (command: BaseCommand) => void): this;
	public once(event: 'groupRegister', listener: (group: BaseCommandGroup, registry: CommandRegistry) => void): this;
	public once(event: 'groupStatusChange', listener: (guild: Guild, group: BaseCommandGroup, enabled: boolean) => void): this;
	public once(event: 'typeRegister', listener: (type: BaseArgumentType, registry: CommandRegistry) => void): this;
	public once(event: 'unknownCommand', listener: (message: BaseMessage) => void): this;

	public once(event: string, listener: Function): this {
		return super.on(event, listener);
	}
}
