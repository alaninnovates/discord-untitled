import { UntitledClient, BaseArgumentType, BaseMessage, disambiguation } from '../';
import { GuildChannel, Util } from 'discord.js';

export class ChannelArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'channel');
	}

	public validate(value: string, msg: BaseMessage): boolean | string {
		const matches: RegExpMatchArray = value.match(/^(?:<#)?([0-9]+)>?$/);
		if (matches) return msg.guild.channels.has(matches[1]);
		const search: string = value.toLowerCase();
		let channels: GuildChannel[] = msg.guild.channels.filterArray(nameFilterInexact(search));
		if (channels.length === 0) return false;
		if (channels.length === 1) return true;
		const exactChannels: GuildChannel[] = channels.filter(nameFilterExact(search));
		if (exactChannels.length === 1) return true;
		if (exactChannels.length > 0) channels = exactChannels;
		return `${disambiguation(channels.map((chan: GuildChannel) => Util.escapeMarkdown(chan.name)), 'channels', null)}\n`;
	}

	public parse(value: string, msg: BaseMessage): GuildChannel {
		const matches: RegExpMatchArray = value.match(/^(?:<#)?([0-9]+)>?$/);
		if (matches) return msg.guild.channels.get(matches[1]) || null;
		const search: string = value.toLowerCase();
		const channels: GuildChannel[] = msg.guild.channels.filterArray(nameFilterInexact(search));
		if (channels.length === 0) return null;
		if (channels.length === 1) return channels[0];
		const exactChannels: GuildChannel[] = channels.filter(nameFilterExact(search));
		if (exactChannels.length === 1) return exactChannels[0];
		return null;
	}
}

function nameFilterExact(search: string): any {
	return (thing: GuildChannel) => thing.name.toLowerCase() === search;
}

function nameFilterInexact(search: string): any {
	return (thing: GuildChannel) => thing.name.toLowerCase().includes(search);
}
