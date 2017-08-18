import { UntitledClient, BaseCommand, BaseCommandGroup, BaseMessage, disambiguation } from '../../';
import { oneLine, stripIndents } from 'common-tags';
import { Collection, Message } from 'discord.js';

export class ReloadCommandCommand<T extends UntitledClient = UntitledClient> extends BaseCommand {
	public readonly client: T;
	public constructor(client: UntitledClient) {
		super(client, {
			name: 'reload',
			aliases: ['reload-command'],
			group: 'commands',
			memberName: 'reload',
			description: 'Reloads a command or command group.',
			details: oneLine`
				The argument must be the name/ID (partial or whole) of a command or command group.
				Providing a command group will reload all of the commands in that group.
				Only the bot owner(s) may use this command.
			`,
			examples: ['reload some-command'],
			guarded: true,

			args: [
				{
					key: 'cmdOrGrp',
					label: 'command/group',
					prompt: 'Which command or group would you like to reload?',
					validate: (val: string) => {
						if (!val) return false;
						const groups: Collection<string, BaseCommandGroup> | BaseCommandGroup[] = this.client.registry.findGroups(val);
						if ((groups as BaseCommandGroup[]).length === 1) return true;
						const commands: Collection<string, BaseCommand> | BaseCommand[] = this.client.registry.findCommands(val);
						if ((commands as BaseCommand[]).length === 1) return true;
						if ((commands as BaseCommand[]).length === 0 && (groups as BaseCommandGroup[]).length === 0) return false;
						return stripIndents`
							${(commands as BaseCommand[]).length > 1 ? disambiguation((commands as BaseCommand[]), 'commands') : ''}
							${(groups as BaseCommandGroup[]).length > 1 ? disambiguation((groups as BaseCommandGroup[]), 'groups') : ''}
						`;
					},
					parse: (val: string) => (this.client.registry.findGroups(val) as BaseCommandGroup[])[0] || (this.client.registry.findCommands(val) as BaseCommand[])[0]
				}
			]
		});
	}

	public hasPermission(msg: BaseMessage): boolean {
		return this.client.isOwner(msg.author);
	}

	public async run(msg: BaseMessage, { cmdOrGrp }: { cmdOrGrp: BaseCommand | BaseCommandGroup }): Promise<Message | Message[]> {
		cmdOrGrp.reload();
		if ((cmdOrGrp as BaseCommand).group) {
			await msg.reply(`Reloaded \`${cmdOrGrp.name}\` command.`);
		} else {
			await msg.reply(`Reloaded all of the commands in the \`${cmdOrGrp.name}\` group.`);
		}
		return null;
	}
}
