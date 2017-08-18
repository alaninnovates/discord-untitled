import { UntitledClient, BaseCommand } from '../';
import { GuildExtension } from '../extensions/GuildExtension';
import { Collection, GuildResolvable } from 'discord.js';

export class BaseCommandGroup<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public id: string;
	public name?: string;
	public guarded?: boolean;
	public cmds?: BaseCommand[];
	public commands?: Collection<string, BaseCommand>;
	public _globalEnabled: boolean;

	/**
	 * @param {string} id - The ID for the group
	 * @param {string} [name=id] - The name of the group
	 * @param {boolean} [guarded=false] - Whether the group should be protected from disabling
	 * @param {BaseCommand[]} [cmds] - The commands that the group contains
	 */
	public constructor(client: T, id: string, name?: string, guarded: boolean = false, cmds: BaseCommand[] = null) {
		if (typeof id !== 'string') throw new TypeError('Group ID must be a string.');
		if (id !== id.toLowerCase()) throw new Error('Group ID must be lowercase.');
		if (cmds && !Array.isArray(cmds)) throw new TypeError('Group commands must be an Array of Commands.');

		/**
		 * Client that this group is for
		 * @name BaseCommandGroup#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = client;

		/**
		 * ID of this group
		 * @type {string}
		 */
		this.id = id;

		/**
		 * Name of this group
		 * @type {string}
		 */
		this.name = name || id;

		/**
		 * The commands in this group (added upon their registration)
		 * @type {Collection<string, BaseCommand>}
		 */
		this.commands = new Collection();
		if (cmds) {
			for (const command of cmds) this.commands.set(command.name, command);
		}

		/**
		 * Whether or not this group is protected from being disabled
		 * @type {boolean}
		 */
		this.guarded = guarded;

		this._globalEnabled = true;
	}

	/**
	 * Enables or disables the group in a guild
	 * @param {?GuildResolvable} guild - Guild to enable/disable the group in
	 * @param {boolean} enabled - Whether the group should be enabled or disabled
	 */
	public setEnabledIn(guild: GuildResolvable, enabled: boolean): void {
		if (typeof guild === 'undefined') throw new TypeError('Guild must not be undefined.');
		if (typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
		if (this.guarded) throw new Error('The group is guarded.');
		if (!guild) {
			this._globalEnabled = enabled;
			this.client.emit('groupStatusChange', null, this, enabled);
			return;
		}
		guild = (this as any).client.resolver.resolveGuild(guild);
		(guild as GuildExtension).setGroupEnabled(this, enabled);
	}

	/**
	 * Checks if the group is enabled in a guild
	 * @param {?GuildResolvable} guild - Guild to check in
	 * @return {boolean} Whether or not the group is enabled
	 */
	public isEnabledIn(guild: GuildResolvable): boolean {
		if (this.guarded) return true;
		if (!guild) return this._globalEnabled;
		guild = (this as any).client.resolver.resolveGuild(guild);
		return (guild as GuildExtension).isGroupEnabled(this);
	}

	/**
	 * Reloads all of the group's commands
	 */
	public reload(): void {
		for (const command of this.commands.values()) command.reload();
	}
}
