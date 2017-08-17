import { UntitledClient, BaseCommand, BaseCommandGroup, BaseSettingProvider } from '../';
import { GuildExtension } from '../extensions/GuildExtension';
import { Guild, Snowflake } from 'discord.js';
import * as Sequelize from 'sequelize';

type Settings = GeneralSettings & CommandSettings & GroupSettings;

type GeneralSettings = {
	prefix: string;
};

type CommandSettings = {
	[key: string]: BaseCommand;
};

type GroupSettings = {
	[key: string]: GroupSettings;
};

export class SequelizeProivder<T extends UntitledClient = UntitledClient> extends BaseSettingProvider {
	public readonly client: T;
	public db: Sequelize.Sequelize;
	private _settings: Map<any, any>;
	private _listeners: Map<any, any>;
	private _model: Sequelize.Model<object, object>;

	public constructor(db: Sequelize.Sequelize) {
		super();

		/**
		 * Client that the provider is for (set once the client is ready, after using {@link UntitledClient#setProvider})
		 * @name SequelizeProvider#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = null;

		this.db = db;

		/**
		 * Settings cached in memory, mapped by guild ID (or 'global')
		 * @type {Map}
		 * @private
		 */
		this._settings = new Map();

		/**
		 * Listeners on the Client, mapped by the event name
		 * @type {Map}
		 * @private
		 */
		this._listeners = new Map();

		this._model = this.db.define('settings', {
			guild: {
				type: Sequelize.BIGINT,
				allowNull: false,
				unique: true,
				primaryKey: true
			},
			settings: { type: Sequelize.TEXT }
		}, { freezeTableName: true, timestamps: false });
	}

	public async init(client: UntitledClient): Promise<void> {
		const rows: any = await this._model.findAll();
		for (const row of rows) {
			let settings: Settings;
			try {
				settings = JSON.parse(row.dataValues.settings);
			} catch (error) {
				client.emit('warn', `SequelizeProvider couldn't parse the settings stored for guild ${row.dataValues.guild}.`);
				continue;
			}

			const guild: Snowflake = row.dataValues.guild !== '0' ? row.dataValues.guild : 'global';

			this._settings.set(guild, settings);
			if (guild !== 'global' && !client.guilds.has(row.dataValues.guild)) {
				continue;
			}
			this.setupGuild(guild, settings);
		}

		this._listeners.set('commandPrefixChange', (guild: Snowflake, prefix: string) => this.set(guild, 'prefix', prefix));
		this._listeners.set('commandStatusChange', (guild: Snowflake, command: BaseCommand, enabled: boolean) => this.set(guild, `cmd-${command.name}`, enabled));
		this._listeners.set('groupStatusChange', (guild: Snowflake, group: BaseCommandGroup, enabled: boolean) => this.set(guild, `grp-${group.id}`, enabled));
		this._listeners.set('guildCreate', (guild: Guild) => {
			const settings: Settings = this._settings.get(guild.id);
			if (!settings) {
				return;
			}
			this.setupGuild(guild.id, settings);
		});
		this._listeners.set('commandRegister', (command: BaseCommand) => {
			for (const [guild, settings] of this._settings) {
				if (guild !== 'global' && !this.client.guilds.has(guild)) {
					continue;
				}
				this.setupGuildCommand(this.client.guilds.get(guild), command, settings);
			}
		});
		this._listeners.set('groupRegister', (group: BaseCommandGroup) => {
			for (const [guild, settings] of this._settings) {
				if (guild !== 'global' && !this.client.guilds.has(guild)) {
					continue;
				}
				this.setupGuildGroup(this.client.guilds.get(guild), group, settings);
			}
		});
		for (const [event, listener] of this._listeners) {
			this.client.on(event, listener);
		}
	}

	public async destroy(): Promise<void> {
		for (const [event, listener] of this._listeners) {
			this.client.removeListener(event, listener);
			this._listeners.clear();
		}
	}

	public get(guild: Guild | Snowflake, key: string, defVal: any): any {
		const settings: Settings = this._settings.get((this.constructor as typeof BaseSettingProvider).getGuildID(guild));
		return settings ? typeof settings[key] !== 'undefined' ? settings[key] : defVal : defVal;
	}

	public async set(guild: Guild | Snowflake, key: string, val: any): Promise<any> {
		guild = (this.constructor as typeof BaseSettingProvider).getGuildID(guild);
		let settings = this._settings.get(guild);
		if (!settings) {
			settings = {};
			this._settings.set(guild, settings);
		}

		settings[key] = val;
		await this._model.upsert(
			{ guild: guild !== 'global' ? guild : '0', settings: JSON.stringify(settings) }
		);
		if (guild === 'global') {
			this.updateOtherShards(key, val);
		}
		return val;
	}

	public async remove(guild: Guild | Snowflake, key: string): Promise<any> {
		guild = (this.constructor as typeof BaseSettingProvider).getGuildID(guild);
		const settings: Settings = this._settings.get(guild);
		if (!settings || typeof settings[key] === 'undefined') {
			return undefined;
		}

		const val = settings[key];
		settings[key] = undefined;
		await this._model.upsert(
			{ guild: guild !== 'global' ? guild : '0', settings: JSON.stringify(settings) }
		);
		if (guild === 'global') {
			this.updateOtherShards(key, undefined);
		}
		return val;
	}

	public async clear(guild: Guild | Snowflake): Promise<void> {
		guild = (this.constructor as typeof BaseSettingProvider).getGuildID(guild);
		if (!this._settings.has(guild)) {
			return;
		}
		this._settings.delete(guild);
		await this._model.destroy({ where: { guild: guild !== 'global' ? guild : '0' } });
	}

	/**
	 * Loads all settings for a guild
	 * @param {string} guild - Guild ID to load the settings of (or 'global')
	 * @param {Object} settings - Settings to load
	 * @private
	 */
	private setupGuild(guild: Guild | Snowflake, settings: Settings): void {
		if (typeof guild !== 'string') {
			throw new TypeError('The guild must be a guild ID or "global".');
		}
		guild = this.client.guilds.get(guild) || null;

		if (typeof settings.prefix !== 'undefined') {
			if (guild) {
				(guild as GuildExtension)._commandPrefix = settings.prefix;
			} else {
				this.client._commandPrefix = settings.prefix;
			}
		}

		for (const command of this.client.registry.commands.values()) {
			this.setupGuildCommand(guild, command, settings);
		}
		for (const group of this.client.registry.groups.values()) {
			this.setupGuildGroup(guild, group, settings);
		}
	}

	/**
	 * Sets up a command's status in a guild from the guild's settings
	 * @param {?Guild} guild - Guild to set the status in
	 * @param {BaseCommand} command - Command to set the status of
	 * @param {Object} settings - Settings of the guild
	 * @private
	 */
	private setupGuildCommand(guild: Guild, command: BaseCommand, settings: Settings): void {
		if (typeof settings[`cmd-${command.name}`] === 'undefined') {
			return;
		}
		if (guild) {
			if (!(guild as GuildExtension)._commandsEnabled) {
				(guild as GuildExtension)._commandsEnabled = {};
			}
			(guild as GuildExtension)._commandsEnabled[command.name] = settings[`cmd-${command.name}`];
		} else {
			command._globalEnabled = settings[`cmd-${command.name}`];
		}
	}

	/**
	 * Sets up a group's status in a guild from the guild's settings
	 * @param {?Guild} guild - Guild to set the status in
	 * @param {BaseCommandGroup} group - Group to set the status of
	 * @param {Object} settings - Settings of the guild
	 * @private
	 */
	private setupGuildGroup(guild: Guild, group: BaseCommandGroup, settings: Settings): void {
		if (typeof settings[`grp-${group.id}`] === 'undefined') {
			return;
		}
		if (guild) {
			if (!(guild as GuildExtension)._groupsEnabled) {
				(guild as GuildExtension)._groupsEnabled = {};
			}
			(guild as GuildExtension)._groupsEnabled[group.id] = settings[`grp-${group.id}`];
		} else {
			group._globalEnabled = settings[`grp-${group.id}`];
		}
	}

	/**
	 * Updates a global setting on all other shards if using the {@link ShardingManager}.
	 * @param {string} key - Key of the setting to update
	 * @param {*} val - Value of the setting
	 * @private
	 */
	private updateOtherShards(key: string, val: string): void {
		if (!this.client.shard) {
			return;
		}
		key = JSON.stringify(key);
		val = typeof val !== 'undefined' ? JSON.stringify(val) : 'undefined';
		this.client.shard.broadcastEval(`
			if (this.shard.id !== ${this.client.shard.id} && this.provider && this.provider.settings) {
				let global = this.provider.settings.get('global');
				if (!global) {
					global = {};
					this.provider.settings.set('global', global);
				}
				global[${key}] = ${val};
			}
		`);
	}
}
