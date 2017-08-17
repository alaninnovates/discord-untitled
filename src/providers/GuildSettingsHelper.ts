import { UntitledClient } from '../';
import { Guild } from 'discord.js';

export class GuildSettingsHelper<T extends UntitledClient = UntitledClient> {
	public readonly client: T;
	public guild: Guild;

	/**
	 * @param {?Guild} guild - Guild the settings are for
	 */
	public constructor(guild?: Guild) {
		/**
		 * Client to use the provider of
		 * @name GuildSettingsHelper#client
		 * @type {UntitledClient}
		 * @readonly
		 */
		this.client = null;

		/**
		 * Guild the settings are for
		 * @type {?Guild}
		 */
		this.guild = guild;
	}

	/**
	 * Gets a setting in the guild
	 * @param {string} key - Name of the setting
	 * @param {*} [defVal] - Value to default to if the setting isn't set
	 * @return {*}
	 * @see {@link SettingProvider#get}
	 */
	public get(key: string, defVal: any): any {
		if (!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.get(this.guild, key, defVal);
	}

	/**
	 * Sets a setting for the guild
	 * @param {string} key - Name of the setting
	 * @param {*} val - Value of the setting
	 * @return {Promise<*>} New value of the setting
	 * @see {@link SettingProvider#set}
	 */
	set(key: string, val: any): Promise<any> {
		if (!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.set(this.guild, key, val);
	}

	/**
	 * Removes a setting from the guild
	 * @param {string} key - Name of the setting
	 * @return {Promise<*>} Old value of the setting
	 * @see {@link SettingProvider#remove}
	 */
	public remove(key: string): Promise<any> {
		if (!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.remove(this.guild, key);
	}

	/**
	 * Removes all settings in the guild
	 * @return {Promise<void>}
	 * @see {@link SettingProvider#clear}
	 */
	public clear(): Promise<void> {
		if (!this.client.provider) throw new Error('No settings provider is available.');
		return this.client.provider.clear(this.guild);
	}
}
