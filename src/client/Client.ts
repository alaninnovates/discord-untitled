import { BaseSettingProvider } from '../';
import { CommandRegistry } from './Registry';
import { CommandDispatcher } from './Dispatcher';
import { GuildSettingsHelper } from '../providers/GuildSettingsHelper';
import { Client, ClientOptions, Message, User, UserResolvable } from 'discord.js';

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
		this.registry = new CommandRegistry();

		/**
		 * The client's command dispatcher
		 * @type {CommandDispatcher}
		 */
		this.dispatcher = new CommandDispatcher(this.registry);

		/**
		 * The client's setting provider
		 * @type {?BaseSettingProvider}
		 */
		this.provider = null;

		/**
		 * Shortcut to use setting provider methods for the global settings
		 * @type {GuildSettingsHelper}
		 */
		this.settings = new GuildSettingsHelper(null);

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

	private async destroy(): Promise<void> {
		super.destroy().then(() => this.provider ? this.provider.destroy() : undefined);
	}
}
