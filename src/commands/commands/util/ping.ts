import { UntitledClient, BaseCommand, BaseCommandGroup, BaseMessage } from '../../../';
import { oneLine } from 'common-tags';
import { Message } from 'discord.js';

export class ListGroupsCommand<T extends UntitledClient = UntitledClient> extends BaseCommand {
	public readonly client: T;
	public constructor(client: T) {
		super(client, {
			name: 'ping',
			group: 'util',
			memberName: 'ping',
			description: 'Checks the bot\'s ping to the Discord server.',
			throttling: {
				usages: 5,
				duration: 10
			}
		});
	}

	public async run(msg: BaseMessage): Promise<Message | Message[]> {
		if (!msg.editable) {
			const pingMsg = await msg.reply('Pinging...');
			return (pingMsg as Message).edit(oneLine`
				${msg.channel.type !== 'dm' ? `${msg.author},` : ''}
				🏓 Pong! The message round-trip took ${(pingMsg as Message).createdTimestamp - msg.createdTimestamp}ms.
				${this.client.ping ? `The heartbeat ping is ${Math.round(this.client.ping)}ms.` : ''}
			`);
		} else {
			await msg.edit('Pinging...');
			return msg.edit(oneLine`
				🏓 Pong! The message round-trip took ${msg.editedTimestamp - msg.createdTimestamp}ms.
				${this.client.ping ? `The heartbeat ping is ${Math.round(this.client.ping)}ms.` : ''}
			`);
		}
	}
}
