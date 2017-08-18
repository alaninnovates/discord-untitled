import { UntitledClient, BaseArgumentType, BaseMessage, disambiguation } from '../';
import { Role, Util } from 'discord.js';

export class RoleArgumentType<T extends UntitledClient = UntitledClient> extends BaseArgumentType {
	public readonly client: T;

	public constructor(client: T) {
		super(client, 'role');
	}

	public validate(value: string, msg: BaseMessage): boolean | string {
		const matches: RegExpMatchArray = value.match(/^(?:<@&)?([0-9]+)>?$/);
		if (matches) return msg.guild.roles.has(matches[1]);
		const search: string = value.toLowerCase();
		let roles: Role[] = msg.guild.roles.filterArray(nameFilterInexact(search));
		if (roles.length === 0) return false;
		if (roles.length === 1) return true;
		const exactRoles: Role[] = roles.filter(nameFilterExact(search));
		if (exactRoles.length === 1) return true;
		if (exactRoles.length > 0) roles = exactRoles;
		return `${disambiguation(roles.map((role: Role) => `${Util.escapeMarkdown(role.name)}`), 'roles', null)}\n`;
	}

	public parse(value: string, msg: BaseMessage): Role {
		const matches: RegExpMatchArray = value.match(/^(?:<@&)?([0-9]+)>?$/);
		if (matches) return msg.guild.roles.get(matches[1]) || null;
		const search: string = value.toLowerCase();
		const roles: Role[] = msg.guild.roles.filterArray(nameFilterInexact(search));
		if (roles.length === 0) return null;
		if (roles.length === 1) return roles[0];
		const exactRoles: Role[] = roles.filter(nameFilterExact(search));
		if (exactRoles.length === 1) return exactRoles[0];
		return null;
	}
}

function nameFilterExact(search: string): any {
	return (thing: Role) => thing.name.toLowerCase() === search;
}

function nameFilterInexact(search: string): any {
	return (thing: Role) => thing.name.toLowerCase().includes(search);
}
