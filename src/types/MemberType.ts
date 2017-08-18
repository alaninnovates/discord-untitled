import { UntitledClient, BaseArgumentType, BaseMessage, disambiguation } from '../';
import { GuildMember, Util } from 'discord.js';

export class MemberArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'member');
	}

	public async validate(value: string, msg: BaseMessage): Promise<boolean | string | GuildMember> {
		const matches: RegExpMatchArray = value.match(/^(?:<@!?)?([0-9]+)>?$/);
		if (matches) {
			try {
				return await msg.guild.fetchMember(await msg.client.fetchUser(matches[1]));
			} catch (err) {
				return false;
			}
		}
		const search: string = value.toLowerCase();
		let members: GuildMember[] = msg.guild.members.filterArray(memberFilterInexact(search));
		if (members.length === 0) return false;
		if (members.length === 1) return members[0];
		const exactMembers: GuildMember[] = members.filter(memberFilterExact(search));
		if (exactMembers.length === 1) return exactMembers[0];
		if (exactMembers.length > 0) members = exactMembers;
		return members.length <= 15 ?
			`${disambiguation(
				members.map((mem: GuildMember) => `${Util.escapeMarkdown(mem.user.username)}#${mem.user.discriminator}`), 'users', null
			)}\n` :
			'Multiple users found. Please be more specific.';
	}

	public parse(value: string, msg: BaseMessage): GuildMember {
		const matches: RegExpMatchArray = value.match(/^(?:<@!?)?([0-9]+)>?$/);
		if (matches) return msg.guild.member(matches[1]) || null;
		const search: string = value.toLowerCase();
		const members: GuildMember[] = msg.guild.members.filterArray(memberFilterInexact(search));
		if (members.length === 0) return null;
		if (members.length === 1) return members[0];
		const exactMembers: GuildMember[] = members.filter(memberFilterExact(search));
		if (exactMembers.length === 1) return members[0];
		return null;
	}
}

function memberFilterExact(search: string): any {
	return (mem: GuildMember) => mem.user.username.toLowerCase() === search ||
		(mem.nickname && mem.nickname.toLowerCase() === search) ||
		`${mem.user.username.toLowerCase()}#${mem.user.discriminator}` === search;
}

function memberFilterInexact(search: string): any {
	return (mem: GuildMember) => mem.user.username.toLowerCase().includes(search) ||
		(mem.nickname && mem.nickname.toLowerCase().includes(search)) ||
		`${mem.user.username.toLowerCase()}#${mem.user.discriminator}`.includes(search);
}
