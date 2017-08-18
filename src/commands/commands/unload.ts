import { UntitledClient, BaseCommand, BaseCommandGroup, BaseMessage, disambiguation } from '../../';
import { oneLine, stripIndents } from 'common-tags';
import { Collection, Message } from 'discord.js';

export class ReloadCommandCommand<T extends UntitledClient = UntitledClient> extends BaseCommand {
	public readonly client: T;
	public constructor(client: UntitledClient) {
		super(client, {
			name: 'unload',
			aliases: ['unload-command'],
			group: 'commands',
			memberName: 'unload',
			description: 'Unloads a command.',
			details: oneLine`
				The argument must be the name/ID (partial or whole) of a command.
				Only the bot owner(s) may use this command.
			`,
			examples: ['unload some-command'],
			guarded: true,

			args: [
				{
					key: 'command',
					prompt: 'Which command would you like to unload?',
					validate: (val: string) => {
						if (!val) return false;
						const commands: Collection<string, BaseCommand> | BaseCommand[] = this.client.registry.findCommands(val);
						if ((commands as BaseCommand[]).length === 1) return true;
						if ((commands as BaseCommand[]).length === 0) return false;
						return disambiguation((commands as BaseCommand[]), 'commands');
					},
					parse: (val: string) => (this.client.registry.findCommands(val) as BaseCommand[])[0]
				}
			]
		});
	}

	public hasPermission(msg: BaseMessage): boolean {
		return this.client.isOwner(msg.author);
	}

	public async run(msg: BaseMessage, { command }: { command: BaseCommand }): Promise<Message | Message[]> {
		command.unload();
		await msg.reply(`Unloaded \`${command.name}\` command.`);
		return null;
	}
}
