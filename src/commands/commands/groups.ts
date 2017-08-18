import { UntitledClient, BaseCommand, BaseCommandGroup, BaseMessage } from '../../';
import { stripIndents } from 'common-tags';
import { Message } from 'discord.js';

export class ListGroupsCommand<T extends UntitledClient = UntitledClient> extends BaseCommand {
	public readonly client: T;
	public constructor(client: UntitledClient) {
		super(client, {
			name: 'groups',
			aliases: ['list-groups', 'show-groups'],
			group: 'commands',
			memberName: 'groups',
			description: 'Lists all command groups.',
			details: 'Only administrators may use this command.',
			guarded: true
		});
	}

	public hasPermission(msg: BaseMessage): boolean {
		if (!msg.guild) return this.client.isOwner(msg.author);
		return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
	}

	public run(msg: BaseMessage): Promise<Message | Message[]> {
		return msg.reply(stripIndents`
			__**Groups**__
			${this.client.registry.groups.map((grp: BaseCommandGroup) =>
				`**${grp.name}:** ${grp.isEnabledIn(msg.guild) ? 'Enabled' : 'Disabled'}`
			).join('\n')}
		`);
	}
}
