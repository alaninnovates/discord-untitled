import { UntitledClient, BaseCommand } from '../';
import { GuildSettingsHelper } from '../providers/GuildSettingsHelper';
import { CommandResolvable, CommandGroupResolvable } from '../client/Registry';
import { Client, Guild, User } from 'discord.js';

export class GuildExtension<T extends UntitledClient = UntitledClient> extends Guild {
	public readonly client: T;
	public _commandPrefix: string;
	public _settings: GuildSettingsHelper;
	public _commandsEnabled: { [index: string]: boolean };
	public _groupsEnabled: { [index: string]: boolean };

	/**
	 * Applies the interface to a class prototype
	 * @param {Function} target - The constructor function to apply to the prototype of
	 */
	public static applyToClass(target: any): void {
		for (const prop of [
			'commandPrefix',
			'settings',
			'setCommandEnabled',
			'isCommandEnabled',
			'setGroupEnabled',
			'isGroupEnabled',
			'commandUsage'
		]) {
			Object.defineProperty(target.prototype, prop, Object.getOwnPropertyDescriptor(this.prototype, prop));
		}
	}

	/**
	 * Command prefix in the guild. An empty string indicates that there is no prefix, and only mentions will be used.
	 * Setting to `null` means that the prefix from {@link UntitledClient#commandPrefix} will be used instead.
	 * @type {string}
	 * @emits {@link UntitledClient#commandPrefixChange}
	 */
	public get commandPrefix(): string {
		if (typeof this._commandPrefix === 'undefined' || this._commandPrefix === null) return this.client.commandPrefix;
		return this._commandPrefix;
	}

	public set commandPrefix(prefix: string) {
		/**
		 * Internal command prefix for the guild, controlled by the {@link GuildExtension#commandPrefix} getter/setter
		 * @name GuildExtension#_commandPrefix
		 * @type {?string}
		 * @private
		 */
		this._commandPrefix = prefix;

		/**
		 * Emitted whenever a guild's command prefix is changed
		 * @event UntitledClient#commandPrefixChange
		 * @param {?Guild} guild - Guild that the prefix was changed in (null for global)
		 * @param {?string} prefix - New command prefix (null for default)
		 */
		this.client.emit('commandPrefixChange', this, this._commandPrefix);
	}

	/**
	 * Shortcut to use setting provider methods for this guild
	 * @type {GuildSettingsHelper}
	 * @readonly
	 */
	public get settings(): GuildSettingsHelper {
		/**
		 * Internal settings helper that is created upon accessing the {@link GuildExtension#settings} getter
		 * @name GuildExtension#_settings
		 * @type {GuildSettingsHelper}
		 * @private
		 */
		if (!this._settings) this._settings = new GuildSettingsHelper(this.client);
		return this._settings;
	}

	/**
	 * Sets whether a command is enabled in the guild
	 * @param {CommandResolvable} command - Command to set status of
	 * @param {boolean} enabled - Whether the command should be enabled
	 */
	public setCommandEnabled(command: CommandResolvable, enabled: boolean): void {
		command = this.client.registry.resolveCommand(command);
		if (command.guarded) throw new Error('The command is guarded.');
		if (typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		enabled = Boolean(enabled);
		if (!this._commandsEnabled) {
			/**
			 * Map object of internal command statuses, mapped by command name
			 * @type {Object}
			 * @private
			 */
			this._commandsEnabled = {};
		}
		this._commandsEnabled[command.name] = enabled;
		/**
		 * Emitted whenever a command is enabled/disabled in a guild
		 * @event UntitledClient#commandStatusChange
		 * @param {?Guild} guild - Guild that the command was enabled/disabled in (null for global)
		 * @param {BaseCommand} command - Command that was enabled/disabled
		 * @param {boolean} enabled - Whether the command is enabled
		 */
		this.client.emit('commandStatusChange', this, command, enabled);
	}

	/**
	 * Checks whether a command is enabled in the guild (does not take the command's group status into account)
	 * @param {CommandResolvable} command - Command to check status of
	 * @return {boolean}
	 */
	public isCommandEnabled(command: CommandResolvable): boolean {
		command = this.client.registry.resolveCommand(command);
		if (command.guarded) return true;
		if (!this._commandsEnabled || typeof this._commandsEnabled[command.name] === 'undefined') {
			return command._globalEnabled;
		}
		return this._commandsEnabled[command.name];
	}

	/**
	 * Sets whether a command group is enabled in the guild
	 * @param {CommandGroupResolvable} group - Command to set status of
	 * @param {boolean} enabled - Whether the group should be enabled
	 */
	public setGroupEnabled(group: CommandGroupResolvable, enabled: boolean): void {
		group = this.client.registry.resolveGroup(group);
		if (group.guarded) throw new Error('The group is guarded.');
		if (typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		enabled = Boolean(enabled);
		if (!this._groupsEnabled) {
			/**
			 * Internal map object of group statuses, mapped by group ID
			 * @type {Object}
			 * @private
			 */
			this._groupsEnabled = {};
		}
		this._groupsEnabled[group.id] = enabled;
		/**
		 * Emitted whenever a command group is enabled/disabled in a guild
		 * @event UntitledClient#groupStatusChange
		 * @param {?Guild} guild - Guild that the group was enabled/disabled in (null for global)
		 * @param {BaseCommandGroup} group - Group that was enabled/disabled
		 * @param {boolean} enabled - Whether the group is enabled
		 */
		this.client.emit('groupStatusChange', this, group, enabled);
	}

	/**
	 * Checks whether a command group is enabled in the guild
	 * @param {CommandGroupResolvable} group - Group to check status of
	 * @return {boolean}
	 */
	public isGroupEnabled(group: CommandGroupResolvable): boolean {
		group = this.client.registry.resolveGroup(group);
		if (group.guarded) return true;
		if (!this._groupsEnabled || typeof this._groupsEnabled[group.id] === 'undefined') return group._globalEnabled;
		return this._groupsEnabled[group.id];
	}

	/**
	 * Creates a command usage string using the guild's prefix
	 * @param {string} [command] - A command + arg string
	 * @param {User} [user=this.client.user] - User to use for the mention command format
	 * @return {string}
	 */
	public commandUsage(command?: string, user: User = this.client.user): string {
		return BaseCommand.usage(command, this.commandPrefix, user);
	}
}
